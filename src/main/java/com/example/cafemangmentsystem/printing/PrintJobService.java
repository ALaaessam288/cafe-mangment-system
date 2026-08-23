package com.example.cafemangmentsystem.printing;

import com.example.cafemangmentsystem.order.entity.Order;
import com.example.cafemangmentsystem.order.entity.OrderItem;
import com.example.cafemangmentsystem.order.entity.OrderItemStatus;
import com.example.cafemangmentsystem.payment.entity.Payment;
import com.example.cafemangmentsystem.payment.entity.PaymentMethod;
import com.example.cafemangmentsystem.printing.dto.PrintJobResponse;
import com.example.cafemangmentsystem.printing.dto.UpdatePrintJobStatusRequest;
import com.example.cafemangmentsystem.printing.entity.PrintJob;
import com.example.cafemangmentsystem.printing.entity.PrintJobStatus;
import com.example.cafemangmentsystem.printing.entity.Printer;
import com.example.cafemangmentsystem.printing.entity.PrinterType;
import com.example.cafemangmentsystem.printing.entity.TicketType;
import com.example.cafemangmentsystem.printing.repository.PrintJobRepository;
import com.example.cafemangmentsystem.printing.repository.PrinterRepository;
import com.example.cafemangmentsystem.station.entity.Station;
import com.example.cafemangmentsystem.station.entity.StationCode;
import com.example.cafemangmentsystem.station.repository.StationRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
@Transactional
public class PrintJobService {

    private final PrintJobRepository printJobRepository;
    private final PrinterRepository printerRepository;
    private final StationRepository stationRepository;

    public void createKitchenTickets(Order order, List<OrderItem> items, boolean isFirstSend) {
        if (items.isEmpty()) {
            return;
        }

        TicketType ticketType = isFirstSend ? TicketType.NEW : TicketType.ADDITION;

        Map<StationCode, List<OrderItem>> byStation = items.stream()
                .collect(Collectors.groupingBy(OrderItem::getStationSnapshot));

        byStation.forEach((stationCode, stationItems) -> {
            Station station = stationRepository.findByCode(stationCode).orElse(null);
            if (station == null || station.getPrinter() == null) {
                log.warn("Skipping {} ticket for order {} - station {} has no printer configured",
                        ticketType, order.getId(), stationCode);
                return;
            }

            String payload = buildKitchenPayload(order, stationItems, ticketType, stationCode);
            String idempotencyKey = deterministicKey(order.getId() + ":" + ticketType + ":" + stationCode + ":"
                    + stationItems.stream().map(i -> i.getId().toString()).sorted().collect(Collectors.joining(",")));

            saveJob(order, station.getPrinter(), ticketType, payload, idempotencyKey);
        });
    }

    public void createCancellationTicket(Order order, OrderItem item) {
        Station station = stationRepository.findByCode(item.getStationSnapshot()).orElse(null);
        if (station == null || station.getPrinter() == null) {
            log.warn("Skipping CANCELLATION ticket for order {} - station {} has no printer configured",
                    order.getId(), item.getStationSnapshot());
            return;
        }

        StringBuilder sb = new StringBuilder();
        sb.append(LINE);
        sb.append("      *** إلغاء صنف ***\n");
        sb.append("      ").append(stationLabel(item.getStationSnapshot())).append("\n");
        sb.append(LINE);
        sb.append("رقم الأوردر : #").append(order.getOrderNumber()).append("\n");
        if (order.getTable() != null) {
            sb.append("الطاولة    : ").append(order.getTable().getNumber()).append("\n");
        } else {
            sb.append("النوع      : تيك أواي\n");
        }
        sb.append("الوقت      : ").append(TIME_FMT.format(Instant.now())).append("\n");
        sb.append(LINE);
        sb.append("  ").append(item.getQuantity()).append(" x  ").append(fullItemName(item)).append("\n");
        sb.append("  >> السبب: ")
                .append(item.getCancelReason() == null ? "-" : item.getCancelReason()).append("\n");
        sb.append(LINE);
        String payload = sb.toString();

        String idempotencyKey = deterministicKey(order.getId() + ":CANCELLATION:" + item.getId());
        saveJob(order, station.getPrinter(), TicketType.CANCELLATION, payload, idempotencyKey);
    }

    public void createReceiptTicket(Order order, List<OrderItem> items, List<Payment> payments) {
        Printer printer = printerRepository.findFirstByType(PrinterType.RECEIPT).orElse(null);
        if (printer == null) {
            log.warn("Skipping RECEIPT ticket for order {} - no RECEIPT-type printer configured", order.getId());
            return;
        }

        String payload = buildReceiptPayload(order, items, payments);
        String idempotencyKey = deterministicKey(order.getId() + ":RECEIPT");

        saveJob(order, printer, TicketType.RECEIPT, payload, idempotencyKey);
    }

    @Transactional(readOnly = true)
    public List<PrintJobResponse> findAll(PrintJobStatus status, Long printerId) {
        List<PrintJob> jobs;
        if (status != null && printerId != null) {
            jobs = printJobRepository.findAllByPrinterIdAndStatus(printerId, status);
        } else if (status != null) {
            jobs = printJobRepository.findAllByStatus(status);
        } else {
            jobs = printJobRepository.findAll();
        }
        return jobs.stream().map(PrintJobResponse::from).toList();
    }

    @Transactional(readOnly = true)
    public List<PrintJobResponse> findAllForOrder(Long orderId) {
        return printJobRepository.findAllByOrderId(orderId).stream().map(PrintJobResponse::from).toList();
    }

    public PrintJobResponse updateStatus(Long id, UpdatePrintJobStatusRequest request) {
        PrintJob job = printJobRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Print job not found: " + id));

        job.setStatus(request.status());

        if (request.status() == PrintJobStatus.PRINTING || request.status() == PrintJobStatus.FAILED) {
            job.setAttempts(job.getAttempts() + 1);
        }
        if (request.status() == PrintJobStatus.FAILED) {
            job.setLastError(request.lastError());
        }
        if (request.status() == PrintJobStatus.PRINTED) {
            job.setPrintedAt(Instant.now());
        }

        return PrintJobResponse.from(job);
    }

    private void saveJob(Order order, Printer printer, TicketType ticketType, String payload, String idempotencyKey) {
        PrintJob job = PrintJob.builder()
                .order(order)
                .printer(printer)
                .ticketType(ticketType)
                .payload(payload)
                .idempotencyKey(idempotencyKey)
                .build();
        printJobRepository.save(job);
    }

    private String deterministicKey(String raw) {
        return UUID.nameUUIDFromBytes(raw.getBytes()).toString();
    }

    private static final String LINE = "================================\n";
    private static final String THIN = "--------------------------------\n";
    private static final DateTimeFormatter TIME_FMT =
            DateTimeFormatter.ofPattern("yyyy/MM/dd  HH:mm").withZone(ZoneId.systemDefault());

    /** Arabic label + intended recipient, so the runner hands the right slip to the right person. */
    private String stationLabel(StationCode code) {
        return switch (code) {
            case KITCHEN -> "المطبخ  /  الشيف";
            case BAR -> "المشروبات  /  الباريستا";
        };
    }

    private String ticketTypeLabel(TicketType type) {
        return switch (type) {
            case NEW -> "طلب جديد";
            case ADDITION -> "إضافة على طلب";
            case CANCELLATION -> "إلغاء صنف";
            case RECEIPT -> "فاتورة";
            case REPRINT -> "إعادة طباعة";
        };
    }

    /** "القسم - الصنف" as the user requires; falls back to product name alone if category is missing. */
    private String fullItemName(OrderItem item) {
        String category = item.getCategoryNameSnapshot();
        if (category == null || category.isBlank()) {
            return item.getProductNameSnapshot();
        }
        return category + " - " + item.getProductNameSnapshot();
    }

    private String buildKitchenPayload(Order order, List<OrderItem> items, TicketType ticketType, StationCode stationCode) {
        StringBuilder sb = new StringBuilder();

        sb.append(LINE);
        sb.append("        ").append(stationLabel(stationCode)).append("\n");
        sb.append("        ").append(ticketTypeLabel(ticketType)).append("\n");
        sb.append(LINE);

        sb.append("رقم الأوردر : #").append(order.getOrderNumber()).append("\n");
        if (order.getTable() != null) {
            sb.append("الطاولة    : ").append(order.getTable().getNumber()).append("\n");
        } else {
            sb.append("النوع      : تيك أواي\n");
            if (order.getCustomerName() != null && !order.getCustomerName().isBlank()) {
                sb.append("العميل     : ").append(order.getCustomerName()).append("\n");
            }
        }
        if (order.getGuestCount() != null) {
            sb.append("عدد الأفراد: ").append(order.getGuestCount()).append("\n");
        }
        if (order.getOpenedBy() != null && order.getOpenedBy().getFullName() != null) {
            sb.append("الكابتن    : ").append(order.getOpenedBy().getFullName()).append("\n");
        }
        sb.append("الوقت      : ").append(TIME_FMT.format(Instant.now())).append("\n");
        sb.append(LINE);

        // Group by category so the chef/barista reads one section per menu section.
        Map<String, List<OrderItem>> byCategory = items.stream()
                .collect(Collectors.groupingBy(
                        i -> i.getCategoryNameSnapshot() == null || i.getCategoryNameSnapshot().isBlank()
                                ? "أخرى" : i.getCategoryNameSnapshot(),
                        LinkedHashMap::new,
                        Collectors.toList()));

        int totalQty = 0;
        for (Map.Entry<String, List<OrderItem>> entry : byCategory.entrySet()) {
            sb.append("[ ").append(entry.getKey()).append(" ]\n");
            for (OrderItem item : entry.getValue()) {
                totalQty += item.getQuantity();
                sb.append("  ").append(item.getQuantity()).append(" x  ")
                        .append(fullItemName(item)).append("\n");
                if (item.getNote() != null && !item.getNote().isBlank()) {
                    sb.append("     >> ملاحظة: ").append(item.getNote()).append("\n");
                }
            }
            sb.append(THIN);
        }

        sb.append("إجمالي الأصناف : ").append(items.size())
                .append("   |   الكمية : ").append(totalQty).append("\n");
        sb.append(LINE);
        return sb.toString();
    }

    private String buildReceiptPayload(Order order, List<OrderItem> items, List<Payment> payments) {
        StringBuilder sb = new StringBuilder();
        sb.append("=== RECEIPT ===\n");
        sb.append("Order #").append(order.getOrderNumber()).append("\n");
        for (OrderItem item : items) {
            if (item.getStatus() == OrderItemStatus.CANCELLED) {
                continue;
            }
            BigDecimal lineTotal = item.getUnitPriceSnapshot().multiply(BigDecimal.valueOf(item.getQuantity()));
            sb.append(" - ").append(item.getQuantity()).append(" x ").append(fullItemName(item))
                    .append(" @ ").append(item.getUnitPriceSnapshot()).append(" = ").append(lineTotal).append("\n");
        }
        sb.append("Subtotal: ").append(order.getSubtotal()).append("\n");
        sb.append("Discount: ").append(order.getDiscount()).append("\n");
        sb.append("Service: ").append(order.getService()).append("\n");
        sb.append("Total: ").append(order.getTotal()).append("\n");
        sb.append("Payments:\n");
        for (Payment payment : payments) {
            sb.append(" - ").append(payment.getMethod()).append(": ").append(payment.getAmount());
            if (payment.getMethod() == PaymentMethod.CASH) {
                sb.append(" (received ").append(payment.getReceived()).append(", change ").append(payment.getChange()).append(")");
            } else if (payment.getReference() != null) {
                sb.append(" (ref ").append(payment.getReference()).append(")");
            }
            sb.append("\n");
        }
        return sb.toString();
    }
}