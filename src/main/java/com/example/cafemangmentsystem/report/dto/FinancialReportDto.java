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
        BigDecimal totalSnacksNet,

        /*
         * Raw-material costing, from the stock ledger.
         *
         * None of these are folded into netProfit, on purpose. Material purchases are normally
         * also entered on the expenses screen as ExpenseType.MATERIALS, which already reduces
         * profit — subtracting the ledger's purchases as well would count the same money twice.
         * They are reported side by side so the two records can be reconciled, which is the first
         * time that has been possible at all.
         */

        /** Cash spent on raw materials in the period, from RESTOCK movements. */
        BigDecimal rawMaterialPurchases,

        /** What was thrown away, valued at each material's standing cost. */
        BigDecimal rawMaterialWasteValue,

        /**
         * Cost of goods sold: the value of materials actually consumed by sales. This is the
         * accrual figure — a sack of beans becomes a cost when it is ground, not when it is bought.
         */
        BigDecimal costOfGoodsSold,

        /** MATERIALS expenses logged separately for the same period, for reconciliation. */
        BigDecimal materialsExpensesLogged
) {
    public record TransactionDto(
            String id, // Or String.valueOf(id) since it can be Order or Expense
            String type, // "ORDER_CAFE", "ORDER_RESTAURANT", "EXPENSE", "WAGE"
            String description,
            BigDecimal amount,
            String date
    ) {}
}
