package com.example.cafemangmentsystem.billing;

import com.example.cafemangmentsystem.billing.entity.*;
import com.example.cafemangmentsystem.billing.repository.SubscriptionInvoiceRepository;
import com.example.cafemangmentsystem.billing.repository.SubscriptionPaymentRepository;
import com.example.cafemangmentsystem.billing.repository.TenantSubscriptionRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ThreadLocalRandom;

/**
 * Invoicing and payment recording.
 *
 * <p>Revenue used to be unknowable: prices lived as an {@code int} on an enum, no row recorded what
 * any tenant had been charged, and "MRR" could only be recomputed from today's prices — so a price
 * change silently rewrote last year's numbers. Every period a tenant is billed for now produces an
 * invoice with the price frozen onto it, and every payment is a row.
 */
@Service
@RequiredArgsConstructor
@Transactional
public class BillingService {

    private static final DateTimeFormatter STAMP = DateTimeFormatter.ofPattern("yyyyMM").withZone(ZoneOffset.UTC);

    private final SubscriptionInvoiceRepository invoiceRepository;
    private final SubscriptionPaymentRepository paymentRepository;
    private final TenantSubscriptionRepository subscriptionRepository;
    private final BillingProperties properties;

    /** Raise the invoice for a subscription period. Free periods (trials) are not invoiced. */
    public SubscriptionInvoice issueFor(TenantSubscription subscription, Instant periodStart, Instant periodEnd) {
        if (subscription.getPriceAtPurchase().compareTo(BigDecimal.ZERO) <= 0) {
            return null;
        }
        SubscriptionInvoice invoice = new SubscriptionInvoice();
        invoice.setInvoiceNumber(nextInvoiceNumber());
        invoice.setTenantId(subscription.getTenantId());
        invoice.setSubscriptionId(subscription.getId());
        invoice.setPlanCode(subscription.getPlan().getCode());
        invoice.setPlanName(subscription.getPlan().getDisplayNameAr());
        invoice.setStatus(InvoiceStatus.ISSUED);
        invoice.setPeriodStart(periodStart);
        invoice.setPeriodEnd(periodEnd);
        invoice.setIssuedAt(Instant.now());
        invoice.setDueAt(Instant.now().plus(Duration.ofDays(properties.getInvoiceDueDays())));
        invoice.setAmount(subscription.getPriceAtPurchase());
        invoice.setCurrency(subscription.getCurrency());
        return invoiceRepository.save(invoice);
    }

    /**
     * Raise an invoice that is already settled — the shape of a licence key redemption or an
     * over-the-counter cash sale, where the money arrived before the subscription did.
     */
    public SubscriptionInvoice issueSettled(TenantSubscription subscription, Instant periodStart, Instant periodEnd,
                                            BigDecimal amount, PaymentMethod method, String reference, String recordedBy) {
        SubscriptionInvoice invoice = new SubscriptionInvoice();
        invoice.setInvoiceNumber(nextInvoiceNumber());
        invoice.setTenantId(subscription.getTenantId());
        invoice.setSubscriptionId(subscription.getId());
        invoice.setPlanCode(subscription.getPlan().getCode());
        invoice.setPlanName(subscription.getPlan().getDisplayNameAr());
        invoice.setPeriodStart(periodStart);
        invoice.setPeriodEnd(periodEnd);
        invoice.setIssuedAt(Instant.now());
        invoice.setAmount(amount);
        invoice.setCurrency(subscription.getCurrency());
        invoice.setStatus(InvoiceStatus.ISSUED);
        invoice = invoiceRepository.save(invoice);

        if (amount.compareTo(BigDecimal.ZERO) > 0) {
            recordPayment(invoice.getId(), amount, method, reference, recordedBy, null);
        } else {
            invoice.setStatus(InvoiceStatus.PAID);
            invoice.setPaidAt(Instant.now());
            invoiceRepository.save(invoice);
        }
        return invoice;
    }

    public SubscriptionPayment recordPayment(Long invoiceId, BigDecimal amount, PaymentMethod method,
                                             String reference, String recordedBy, String notes) {
        SubscriptionInvoice invoice = invoiceRepository.findById(invoiceId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Invoice not found: " + invoiceId));
        if (invoice.getStatus() == InvoiceStatus.VOID) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Cannot pay a voided invoice");
        }
        if (amount == null || amount.compareTo(BigDecimal.ZERO) <= 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Payment amount must be positive");
        }

        SubscriptionPayment payment = new SubscriptionPayment();
        payment.setTenantId(invoice.getTenantId());
        payment.setInvoiceId(invoice.getId());
        payment.setAmount(amount);
        payment.setCurrency(invoice.getCurrency());
        payment.setMethod(method);
        payment.setReference(reference);
        payment.setReceivedAt(Instant.now());
        payment.setRecordedBy(recordedBy);
        payment.setNotes(notes);
        payment = paymentRepository.save(payment);

        BigDecimal paid = paymentRepository.sumForInvoice(invoice.getId());
        invoice.setAmountPaid(paid);
        if (paid.compareTo(invoice.getAmount()) >= 0) {
            invoice.setStatus(InvoiceStatus.PAID);
            invoice.setPaidAt(payment.getReceivedAt());
        } else {
            invoice.setStatus(InvoiceStatus.PARTIALLY_PAID);
        }
        invoiceRepository.save(invoice);
        return payment;
    }

    public SubscriptionInvoice voidInvoice(Long invoiceId, String reason) {
        SubscriptionInvoice invoice = invoiceRepository.findById(invoiceId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Invoice not found: " + invoiceId));
        if (invoice.getStatus() == InvoiceStatus.PAID) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Refund a paid invoice rather than voiding it");
        }
        invoice.setStatus(InvoiceStatus.VOID);
        invoice.setNotes(reason);
        return invoiceRepository.save(invoice);
    }

    @Transactional(readOnly = true)
    public List<SubscriptionInvoice> invoicesFor(Long tenantId) {
        return invoiceRepository.findByTenantIdOrderByIssuedAtDesc(tenantId);
    }

    @Transactional(readOnly = true)
    public List<SubscriptionPayment> paymentsFor(Long tenantId) {
        return paymentRepository.findByTenantIdOrderByReceivedAtDesc(tenantId);
    }

    /**
     * Platform revenue. MRR is summed from what each live subscription actually pays, normalised to
     * a month by its own billing period — an annual plan contributes a twelfth, not its whole price.
     */
    @Transactional(readOnly = true)
    public Map<String, Object> revenueStats() {
        Instant now = Instant.now();
        Instant monthStart = now.minus(Duration.ofDays(30));

        BigDecimal mrr = BigDecimal.ZERO;
        for (TenantSubscription subscription : subscriptionRepository.findByCurrentTrue()) {
            if (!subscription.getStatus().isLive()) continue;
            int periodDays = Math.max(1, subscription.getPlan().getBillingPeriodDays());
            BigDecimal monthly = subscription.getPriceAtPurchase()
                    .multiply(BigDecimal.valueOf(30))
                    .divide(BigDecimal.valueOf(periodDays), 2, java.math.RoundingMode.HALF_UP);
            mrr = mrr.add(monthly);
        }

        return Map.of(
                "mrr", mrr,
                "arr", mrr.multiply(BigDecimal.valueOf(12)),
                "collectedLast30Days", invoiceRepository.sumCollectedBetween(monthStart, now),
                "outstanding", invoiceRepository.sumOutstanding(),
                "currency", "EGP"
        );
    }

    private String nextInvoiceNumber() {
        for (int attempt = 0; attempt < 12; attempt++) {
            String candidate = "%s-%s-%06d".formatted(
                    properties.getInvoicePrefix(), STAMP.format(Instant.now()),
                    ThreadLocalRandom.current().nextInt(1_000_000));
            if (!invoiceRepository.existsByInvoiceNumber(candidate)) {
                return candidate;
            }
        }
        throw new IllegalStateException("Could not allocate an invoice number");
    }
}
