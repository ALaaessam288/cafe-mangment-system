package com.example.cafemangmentsystem.billing.dto;

import com.example.cafemangmentsystem.billing.entity.InvoiceStatus;
import com.example.cafemangmentsystem.billing.entity.SubscriptionInvoice;

import java.math.BigDecimal;
import java.time.Instant;

/**
 * One invoice as the platform console needs it — with the tenant's name resolved, so the operator
 * is not reading a list of numeric ids.
 *
 * <p>The admin endpoints previously returned {@link SubscriptionInvoice} entities straight out of
 * the controller. That serialises whatever the entity happens to carry, hands the client fields it
 * has no business seeing, and turns any future column rename into a silent breaking change for the
 * UI.
 */
public record AdminInvoiceDto(
        Long id,
        String invoiceNumber,
        Long tenantId,
        String tenantName,
        String planCode,
        String planName,
        InvoiceStatus status,
        Instant issuedAt,
        Instant dueAt,
        Instant paidAt,
        Instant periodStart,
        Instant periodEnd,
        BigDecimal amount,
        BigDecimal amountPaid,
        BigDecimal balanceDue,
        String currency,
        boolean overdue,
        String notes
) {
    public static AdminInvoiceDto from(SubscriptionInvoice i, String tenantName) {
        BigDecimal paid = i.getAmountPaid() == null ? BigDecimal.ZERO : i.getAmountPaid();
        BigDecimal amount = i.getAmount() == null ? BigDecimal.ZERO : i.getAmount();
        BigDecimal balance = amount.subtract(paid).max(BigDecimal.ZERO);
        boolean unsettled = i.getStatus() == InvoiceStatus.ISSUED
                || i.getStatus() == InvoiceStatus.PARTIALLY_PAID;
        boolean overdue = unsettled && i.getDueAt() != null && i.getDueAt().isBefore(Instant.now());
        return new AdminInvoiceDto(
                i.getId(), i.getInvoiceNumber(), i.getTenantId(), tenantName,
                i.getPlanCode(), i.getPlanName(), i.getStatus(),
                i.getIssuedAt(), i.getDueAt(), i.getPaidAt(),
                i.getPeriodStart(), i.getPeriodEnd(),
                amount, paid, balance, i.getCurrency(), overdue, i.getNotes());
    }
}
