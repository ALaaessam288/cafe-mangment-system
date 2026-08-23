package com.example.cafemangmentsystem.report.dto;

import java.math.BigDecimal;
import java.util.List;

public record FinancialReportDto(
        BigDecimal totalCafeRevenue,
        BigDecimal totalRestaurantRevenue,
        BigDecimal totalCafeExpenses,
        BigDecimal totalRestaurantExpenses,
        BigDecimal totalGeneralExpenses,
        BigDecimal totalWages,
        BigDecimal netProfit,
        List<TransactionDto> transactions,
        List<ReportItemDto> productSales,
        List<ReportItemDto> categorySales,
        List<PaymentMethodBreakdownDto> paymentMethods,
        BigDecimal totalOutstandingDebts,
        int outstandingDebtsCount,
        BigDecimal totalSnacksNet
) {
    public record TransactionDto(
            String id, // Or String.valueOf(id) since it can be Order or Expense
            String type, // "ORDER_CAFE", "ORDER_RESTAURANT", "EXPENSE", "WAGE"
            String description,
            BigDecimal amount,
            String date
    ) {}
}
