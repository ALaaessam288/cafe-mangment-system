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

        String payload = "=== CANCELLATION ===\n"
                + "Order #" + order.getOrderNumber() + "\n"
                + "CANCEL: " + item.getQuantity() + " x " + item.getProductNameSnapshot()
                + " - reason: " + item.getCancelReason() + "\n";

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

    private String buildKitchenPayload(Order order, List<OrderItem> items, TicketType ticketType, StationCode stationCode) {
        StringBuilder sb = new StringBuilder();
        sb.append("=== ").append(stationCode).append(" TICKET (").append(ticketType).append(") ===\n");
        sb.append("Order #").append(order.getOrderNumber());
        if (order.getTable() != null) {
            sb.append(" - Table ").append(order.getTable().getNumber());
        } else {
            sb.append(" - TAKEAWAY");
        }
        sb.append("\n");
        for (OrderItem item : items) {
            sb.append(" - ").append(item.getQuantity()).append(" x ").append(item.getProductNameSnapshot());
            if (item.getNote() != null && !item.getNote().isBlank()) {
                sb.append(" (").append(item.getNote()).append(")");
            }
            sb.append("\n");
        }
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
            sb.append(" - ").append(item.getQuantity()).append(" x ").append(item.getProductNameSnapshot())
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