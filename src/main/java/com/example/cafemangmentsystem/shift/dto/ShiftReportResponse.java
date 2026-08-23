package com.example.cafemangmentsystem.shift.dto;

import java.math.BigDecimal;
import java.util.List;

public record ShiftReportResponse(
        ShiftResponse shift,
        BigDecimal totalRevenue,
        BigDecimal totalCash,
        BigDecimal totalInstapay,
        BigDecimal totalWallet,
        BigDecimal foodRevenue,
        BigDecimal buffetRevenue,
        BigDecimal snacksNet,
        BigDecimal totalDiscounts,
        BigDecimal totalService,
        BigDecimal totalExpenses,
        List<ExpenseSummaryItem> expenses,
        BigDecimal totalNewDebts,
        BigDecimal totalCollectedDebts,
        BigDecimal totalEmployeeAdvances,
        BigDecimal totalEmployeeDeductions,
        BigDecimal totalEmployeeBonuses,
        List<EmployeeMovementSummaryItem> employeeMovements,
        List<ProductSalesSummaryItem> productSales,
        Integer totalItemsSold,
        BigDecimal expectedCashInDrawer
) {
    public record ExpenseSummaryItem(Long id, String description, BigDecimal amount, String category, String recordedAt) {}
    public record EmployeeMovementSummaryItem(Long id, String employeeName, String type, BigDecimal amount, String notes, String recordedAt) {}
    public record ProductSalesSummaryItem(String productName, String categoryName, Integer quantitySold, BigDecimal totalAmount, String revenueLine) {}
}
