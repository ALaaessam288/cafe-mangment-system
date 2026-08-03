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
import com.example.cafemangmentsystem.report.dto.FinancialReportDto;
import com.example.cafemangmentsystem.report.dto.FinancialReportDto.TransactionDto;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

@Service
@RequiredArgsConstructor
public class ReportService {

    private final OrderRepository orderRepository;
    private final OrderItemRepository orderItemRepository;
    private final ExpenseRepository expenseRepository;

    @Transactional(readOnly = true)
    public FinancialReportDto getComprehensiveFinancialReport() {
        List<Order> closedOrders = orderRepository.findByStatus(OrderStatus.CLOSED);
        List<Expense> allExpenses = expenseRepository.findAll();

        BigDecimal totalCafeRevenue = BigDecimal.ZERO;
        BigDecimal totalRestaurantRevenue = BigDecimal.ZERO;

        BigDecimal totalCafeExpenses = BigDecimal.ZERO;
        BigDecimal totalRestaurantExpenses = BigDecimal.ZERO;
        BigDecimal totalGeneralExpenses = BigDecimal.ZERO;
        BigDecimal totalWages = BigDecimal.ZERO;

        List<TransactionDto> transactions = new ArrayList<>();

        for (Order order : closedOrders) {
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

        for (Expense expense : allExpenses) {
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

        BigDecimal netProfit = totalCafeRevenue.add(totalRestaurantRevenue)
                .subtract(totalCafeExpenses)
                .subtract(totalRestaurantExpenses)
                .subtract(totalGeneralExpenses)
                .subtract(totalWages);

        // Sort transactions by date descending
        transactions.sort(Comparator.comparing(TransactionDto::date).reversed());

        return new FinancialReportDto(
                totalCafeRevenue,
                totalRestaurantRevenue,
                totalCafeExpenses,
                totalRestaurantExpenses,
                totalGeneralExpenses,
                totalWages,
                netProfit,
                transactions
        );
    }
}
