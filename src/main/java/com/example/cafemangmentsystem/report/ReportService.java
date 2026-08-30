package com.example.cafemangmentsystem.report;

import com.example.cafemangmentsystem.expense.entity.Expense;
import com.example.cafemangmentsystem.expense.entity.ExpenseType;
import com.example.cafemangmentsystem.expense.repository.ExpenseRepository;
import com.example.cafemangmentsystem.menu.entity.RevenueLine;
import com.example.cafemangmentsystem.order.entity.Order;
import com.example.cafemangmentsystem.order.entity.OrderItem;
import com.example.cafemangmentsystem.order.entity.OrderItemStatus;
import com.example.cafemangmentsystem.order.entity.OrderStatus;
import com.example.cafemangmentsystem.order.repository.OrderItemRepository;
import com.example.cafemangmentsystem.order.repository.OrderRepository;
import com.example.cafemangmentsystem.payment.entity.Payment;
import com.example.cafemangmentsystem.payment.repository.PaymentRepository;
import com.example.cafemangmentsystem.report.dto.FinancialReportDto;
import com.example.cafemangmentsystem.report.dto.FinancialReportDto.TransactionDto;
import com.example.cafemangmentsystem.report.dto.PaymentMethodBreakdownDto;
import com.example.cafemangmentsystem.report.dto.ReportItemDto;
import com.example.cafemangmentsystem.debt.entity.Debt;
import com.example.cafemangmentsystem.debt.repository.DebtRepository;
import com.example.cafemangmentsystem.shift.entity.Shift;
import com.example.cafemangmentsystem.shift.repository.ShiftRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.example.cafemangmentsystem.report.dto.BestSellerDto;
import com.example.cafemangmentsystem.report.dto.HourlySlotDto;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.springframework.data.domain.PageRequest;

@Service
@RequiredArgsConstructor
public class ReportService {

    private final OrderRepository orderRepository;
    private final OrderItemRepository orderItemRepository;
    private final ExpenseRepository expenseRepository;
    private final PaymentRepository paymentRepository;
    private final ShiftRepository shiftRepository;
    private final DebtRepository debtRepository;

    private static class SalesAccumulator {
        final String name;
        long quantity = 0;
        BigDecimal revenue = BigDecimal.ZERO;

        SalesAccumulator(String name) {
            this.name = name;
        }
    }

    @Transactional(readOnly = true)
    public FinancialReportDto getComprehensiveFinancialReport(String startDate, String endDate, Long shiftId) {
        Instant startInstant = null;
        Instant endInstant = null;
        LocalDate localStart = null;
        LocalDate localEnd = null;

        if (shiftId != null) {
            Shift shift = shiftRepository.findById(shiftId)
                    .orElseThrow(() -> new org.springframework.web.server.ResponseStatusException(org.springframework.http.HttpStatus.NOT_FOUND, "Shift not found"));
            startInstant = shift.getOpenedAt();
            endInstant = shift.getClosedAt() != null ? shift.getClosedAt() : Instant.now();
            localStart = startInstant.atZone(ZoneId.of("Africa/Cairo")).toLocalDate();
            localEnd = endInstant.atZone(ZoneId.of("Africa/Cairo")).toLocalDate();
        } else {
            if (startDate != null && !startDate.trim().isEmpty()) {
                try {
                    localStart = LocalDate.parse(startDate.trim());
                    startInstant = localStart.atStartOfDay(ZoneId.of("Africa/Cairo")).toInstant();
                } catch (Exception e) {
                    // Ignore parse errors
                }
            }
            if (endDate != null && !endDate.trim().isEmpty()) {
                try {
                    localEnd = LocalDate.parse(endDate.trim());
                    endInstant = localEnd.atTime(LocalTime.MAX).atZone(ZoneId.of("Africa/Cairo")).toInstant();
                } catch (Exception e) {
                    // Ignore parse errors
                }
            }
        }

        List<Order> closedOrders = orderRepository.findByStatus(OrderStatus.CLOSED);
        List<Expense> allExpenses = expenseRepository.findAll();

        final Instant finalStart = startInstant;
        final Instant finalEnd = endInstant;
        List<Order> filteredOrders = closedOrders.stream()
                .filter(o -> {
                    Instant t = o.getClosedAt() != null ? o.getClosedAt() : o.getOpenedAt();
                    if (finalStart != null && t.isBefore(finalStart)) return false;
                    if (finalEnd != null && t.isAfter(finalEnd)) return false;
                    return true;
                })
                .toList();

        final LocalDate finalLocalStart = localStart;
        final LocalDate finalLocalEnd = localEnd;
        List<Expense> filteredExpenses = allExpenses.stream()
                .filter(e -> {
                    LocalDate d = e.getExpenseDate();
                    if (finalLocalStart != null && d.isBefore(finalLocalStart)) return false;
                    if (finalLocalEnd != null && d.isAfter(finalLocalEnd)) return false;
                    return true;
                })
                .toList();

        BigDecimal totalCafeRevenue = BigDecimal.ZERO;
        BigDecimal totalRestaurantRevenue = BigDecimal.ZERO;

        BigDecimal totalCafeExpenses = BigDecimal.ZERO;
        BigDecimal totalRestaurantExpenses = BigDecimal.ZERO;
        BigDecimal totalGeneralExpenses = BigDecimal.ZERO;
        BigDecimal totalWages = BigDecimal.ZERO;

        List<TransactionDto> transactions = new ArrayList<>();
        Map<String, SalesAccumulator> productMap = new HashMap<>();
        Map<String, SalesAccumulator> categoryMap = new HashMap<>();

        for (Order order : filteredOrders) {
            List<OrderItem> items = orderItemRepository.findByOrder(order);
            BigDecimal orderCafeTotal = BigDecimal.ZERO;
            BigDecimal orderRestTotal = BigDecimal.ZERO;

            for (OrderItem item : items) {
                if (item.getStatus() == OrderItemStatus.CANCELLED) continue;
                BigDecimal itemTotal = item.getUnitPriceSnapshot()
                        .multiply(BigDecimal.valueOf(item.getQuantity()))
                        .subtract(item.getDiscountAmount());

                if (item.getRevenueLineSnapshot() == RevenueLine.BUFFET) {
                    orderCafeTotal = orderCafeTotal.add(itemTotal);
                } else if (item.getRevenueLineSnapshot() == RevenueLine.FOOD) {
                    orderRestTotal = orderRestTotal.add(itemTotal);
                }

                // Product sales accumulation
                String prodName = item.getProductNameSnapshot();
                SalesAccumulator prodAcc = productMap.computeIfAbsent(prodName, SalesAccumulator::new);
                prodAcc.quantity += item.getQuantity();
                prodAcc.revenue = prodAcc.revenue.add(itemTotal);

                // Category sales accumulation
                String catName = (item.getProduct() != null && item.getProduct().getCategory() != null)
                        ? item.getProduct().getCategory().getNameAr()
                        : "غير معروف";
                SalesAccumulator catAcc = categoryMap.computeIfAbsent(catName, SalesAccumulator::new);
                catAcc.quantity += item.getQuantity();
                catAcc.revenue = catAcc.revenue.add(itemTotal);
            }

            // Item lines alone don't account for order-level discount/service charge/delivery
            // fee (Order.discount/service/deliveryFee) - reconcile against the real order total
            // (what payments actually collect) so totalCafeRevenue + totalRestaurantRevenue
            // matches the Payment Methods breakdown and the transactions ledger below, both of
            // which already use order.getTotal(). The adjustment is split proportionally by each
            // line's share of the item subtotal, since service/delivery/order-discount aren't
            // attributable to a specific product.
            BigDecimal itemsTotal = orderCafeTotal.add(orderRestTotal);
            BigDecimal adjustment = order.getTotal().subtract(itemsTotal);
            if (itemsTotal.signum() != 0) {
                BigDecimal cafeShare = orderCafeTotal.divide(itemsTotal, 10, RoundingMode.HALF_UP);
                orderCafeTotal = orderCafeTotal.add(adjustment.multiply(cafeShare));
                orderRestTotal = order.getTotal().subtract(orderCafeTotal);
            } else {
                orderRestTotal = orderRestTotal.add(adjustment);
            }

            totalCafeRevenue = totalCafeRevenue.add(orderCafeTotal);
            totalRestaurantRevenue = totalRestaurantRevenue.add(orderRestTotal);

            transactions.add(new TransactionDto(
                    "ORDER-" + order.getId(),
                    "ORDER",
                    "Order #" + order.getOrderNumber(),
                    order.getTotal(),
                    order.getClosedAt() != null ? order.getClosedAt().toString() : order.getOpenedAt().toString()
            ));
        }

        for (Expense expense : filteredExpenses) {
            if (expense.getType() == ExpenseType.SALARIES) {
                totalWages = totalWages.add(expense.getAmount());
                String empName = expense.getEmployee() != null ? expense.getEmployee().getName() : "Unknown";
                transactions.add(new TransactionDto(
                        "EXP-" + expense.getId(),
                        "WAGE",
                        "Salary: " + empName,
                        expense.getAmount().negate(),
                        expense.getExpenseDate().toString()
                ));
            } else {
                if (expense.getRevenueLine() == RevenueLine.BUFFET) {
                    totalCafeExpenses = totalCafeExpenses.add(expense.getAmount());
                } else if (expense.getRevenueLine() == RevenueLine.FOOD) {
                    totalRestaurantExpenses = totalRestaurantExpenses.add(expense.getAmount());
                } else {
                    totalGeneralExpenses = totalGeneralExpenses.add(expense.getAmount());
                }

                transactions.add(new TransactionDto(
                        "EXP-" + expense.getId(),
                        "EXPENSE",
                        expense.getType().name() + " - " + expense.getRevenueLine().name(),
                        expense.getAmount().negate(),
                        expense.getExpenseDate().toString()
                ));
            }
        }

        // Payment Methods Breakdown aggregation
        List<Long> orderIds = filteredOrders.stream().map(Order::getId).toList();
        Map<String, SalesAccumulator> paymentMap = new HashMap<>();
        paymentMap.put("CASH", new SalesAccumulator("CASH"));
        paymentMap.put("INSTAPAY", new SalesAccumulator("INSTAPAY"));
        paymentMap.put("WALLET", new SalesAccumulator("WALLET"));

        if (!orderIds.isEmpty()) {
            List<Payment> payments = paymentRepository.findByOrderIdIn(orderIds);
            for (Payment p : payments) {
                String method = p.getMethod().name();
                SalesAccumulator payAcc = paymentMap.computeIfAbsent(method, SalesAccumulator::new);
                payAcc.quantity += 1;
                payAcc.revenue = payAcc.revenue.add(p.getAmount());
            }
        }

        BigDecimal totalSnacksNet = BigDecimal.ZERO;
        if (shiftId != null) {
            Shift shift = shiftRepository.findById(shiftId).orElse(null);
            if (shift != null && shift.getSnacksNet() != null) {
                totalSnacksNet = shift.getSnacksNet();
            }
        } else {
            List<Shift> shifts = shiftRepository.findAll();
            for (Shift s : shifts) {
                if (s.getSnacksNet() != null && s.getSnacksNet().compareTo(BigDecimal.ZERO) > 0) {
                    Instant t = s.getClosedAt() != null ? s.getClosedAt() : s.getOpenedAt();
                    if ((finalStart == null || !t.isBefore(finalStart)) && (finalEnd == null || !t.isAfter(finalEnd))) {
                        totalSnacksNet = totalSnacksNet.add(s.getSnacksNet());
                    }
                }
            }
        }

        BigDecimal netProfit = totalCafeRevenue.add(totalRestaurantRevenue).add(totalSnacksNet)
                .subtract(totalCafeExpenses)
                .subtract(totalRestaurantExpenses)
                .subtract(totalGeneralExpenses)
                .subtract(totalWages);

        // Sort transactions by date descending
        transactions.sort(Comparator.comparing(TransactionDto::date).reversed());

        List<ReportItemDto> productSales = productMap.values().stream()
                .sorted((a, b) -> Long.compare(b.quantity, a.quantity))
                .map(acc -> new ReportItemDto(acc.name, acc.quantity, acc.revenue))
                .toList();

        List<ReportItemDto> categorySales = categoryMap.values().stream()
                .sorted((a, b) -> b.revenue.compareTo(a.revenue))
                .map(acc -> new ReportItemDto(acc.name, acc.quantity, acc.revenue))
                .toList();

        List<PaymentMethodBreakdownDto> paymentMethods = paymentMap.values().stream()
                .map(acc -> new PaymentMethodBreakdownDto(acc.name, acc.revenue, acc.quantity))
                .toList();

        // Outstanding debts are a running liability balance, not a period flow - not date-filtered.
        List<Debt> unsettledDebts = debtRepository.findBySettledFalse();
        BigDecimal totalOutstandingDebts = unsettledDebts.stream()
                .map(d -> {
                    BigDecimal paid = d.getPaidAmount() != null ? d.getPaidAmount() : BigDecimal.ZERO;
                    BigDecimal rem = d.getAmount().subtract(paid);
                    return rem.compareTo(BigDecimal.ZERO) > 0 ? rem : BigDecimal.ZERO;
                })
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        return new FinancialReportDto(
                totalCafeRevenue,
                totalRestaurantRevenue,
                totalCafeExpenses,
                totalRestaurantExpenses,
                totalGeneralExpenses,
                totalWages,
                netProfit,
                transactions,
                productSales,
                categorySales,
                paymentMethods,
                totalOutstandingDebts,
                unsettledDebts.size(),
                totalSnacksNet
        );
    }

    @Transactional(readOnly = true)
    public List<BestSellerDto> getBestSellers(String startDate, String endDate, int limit) {
        Instant[] range = resolveDateRange(startDate, endDate);
        List<Object[]> rows = orderItemRepository.findTopProductsByQuantity(
                range[0], range[1], PageRequest.of(0, limit));
        return rows.stream()
                .map(r -> new BestSellerDto(
                        (String) r[0],
                        ((Number) r[1]).longValue(),
                        (BigDecimal) r[2]))
                .toList();
    }

    @Transactional(readOnly = true)
    public List<HourlySlotDto> getHourlySales(String startDate, String endDate) {
        Instant[] range = resolveDateRange(startDate, endDate);
        // Hourly data is in UTC; frontend shifts by +2 for Egypt display
        List<Object[]> rows = orderRepository.findHourlySales(range[0], range[1]);
        return rows.stream()
                .map(r -> new HourlySlotDto(
                        ((Number) r[0]).intValue(),
                        ((Number) r[1]).longValue(),
                        (BigDecimal) r[2]))
                .toList();
    }

    private Instant[] resolveDateRange(String startDate, String endDate) {
        Instant start = null, end = null;
        if (startDate != null && !startDate.isBlank()) {
            try { start = LocalDate.parse(startDate.trim())
                    .atStartOfDay(ZoneId.of("Africa/Cairo")).toInstant(); } catch (Exception ignored) {}
        }
        if (endDate != null && !endDate.isBlank()) {
            try { end = LocalDate.parse(endDate.trim())
                    .atTime(LocalTime.MAX).atZone(ZoneId.of("Africa/Cairo")).toInstant(); } catch (Exception ignored) {}
        }
        return new Instant[]{ start, end };
    }
}
