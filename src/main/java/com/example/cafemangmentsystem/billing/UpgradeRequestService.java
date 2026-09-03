package com.example.cafemangmentsystem.billing;

import com.example.cafemangmentsystem.billing.entity.*;
import com.example.cafemangmentsystem.billing.repository.UpgradeRequestRepository;
import com.example.cafemangmentsystem.common.tenant.CurrentActor;
import com.example.cafemangmentsystem.tenant.entity.Tenant;
import com.example.cafemangmentsystem.tenant.repository.TenantRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

/**
 * The manual upgrade path: the customer asks, transfers the money, and the platform confirms.
 *
 * <p>Approval is the only place a bank transfer turns into a subscription, and it does so through
 * the same {@link SubscriptionService#changePlan} and {@link BillingService} calls a licence key
 * uses. That matters: whichever way a café pays, the resulting subscription, invoice and payment
 * rows are identical, so revenue reporting does not have to know how the money arrived.
 */
@Service
@RequiredArgsConstructor
@Transactional
@Slf4j
public class UpgradeRequestService {

    private final UpgradeRequestRepository repository;
    private final PlanService planService;
    private final SubscriptionService subscriptionService;
    private final BillingService billingService;
    private final TenantRepository tenantRepository;

    // ── Customer side ───────────────────────────────────────────────────────

    public UpgradeRequest submit(Long tenantId, String planCode, Integer periodDays,
                                 String contactName, String contactPhone,
                                 String transferReference, String note) {
        Plan plan = planService.requireByCode(planCode);
        if (plan.isCustomPlan()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "الباقة المخصصة تُفعَّل عبر فريق المبيعات مباشرة.");
        }
        if (plan.isSelfSelectable()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "هذه الباقة مجانية ولا تحتاج تحويلاً بنكياً.");
        }

        // One open request at a time. Otherwise a customer clicking twice creates two, and whoever
        // reviews them approves both — two periods and two invoices for one transfer.
        repository.findFirstByTenantIdAndStatusOrderByCreatedAtDesc(tenantId, UpgradeRequestStatus.PENDING)
                .ifPresent(existing -> {
                    throw new ResponseStatusException(HttpStatus.CONFLICT,
                            "لديك طلب ترقية قيد المراجعة بالفعل. سنتواصل معك قريباً.");
                });

        Tenant tenant = tenantRepository.findById(tenantId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Tenant not found"));

        int days = periodDays != null && periodDays > 0 ? periodDays : plan.getBillingPeriodDays();
        BigDecimal quote = quoteFor(plan, days);

        UpgradeRequest request = new UpgradeRequest();
        request.setTenantId(tenantId);
        request.setRequestedPlanCode(plan.getCode());
        request.setRequestedPeriodDays(days);
        request.setQuotedAmount(quote);
        request.setCurrency(plan.getCurrency());
        request.setContactName(contactName);
        request.setContactPhone(blankTo(contactPhone, tenant.getOwnerWhatsapp()));
        request.setTransferReference(transferReference);
        request.setCustomerNote(note);
        request.setSubmittedBy(CurrentActor.name());

        UpgradeRequest saved = repository.save(request);
        subscriptionService.audit(tenantId, "UPGRADE_REQUESTED",
                "طلب ترقية إلى " + plan.getDisplayNameAr() + " بمبلغ " + quote + " " + plan.getCurrency());
        return saved;
    }

    /** Pro-rates the plan's price over the requested period, rounded to the piastre. */
    private BigDecimal quoteFor(Plan plan, int days) {
        int period = Math.max(1, plan.getBillingPeriodDays());
        if (days == period) return plan.getPrice();
        return plan.getPrice()
                .multiply(BigDecimal.valueOf(days))
                .divide(BigDecimal.valueOf(period), 2, java.math.RoundingMode.HALF_UP);
    }

    @Transactional(readOnly = true)
    public List<UpgradeRequest> forTenant(Long tenantId) {
        return repository.findByTenantIdOrderByCreatedAtDesc(tenantId);
    }

    public UpgradeRequest withdraw(Long tenantId, Long requestId) {
        UpgradeRequest request = require(requestId);
        if (!request.getTenantId().equals(tenantId)) {
            // Deliberately 404, not 403: confirming the id exists would leak other tenants' requests.
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Request not found");
        }
        if (!request.isOpen()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "تمت مراجعة هذا الطلب بالفعل.");
        }
        request.setStatus(UpgradeRequestStatus.CANCELLED);
        request.setReviewedAt(Instant.now());
        request.setReviewedBy(CurrentActor.name());
        return repository.save(request);
    }

    // ── Platform side ───────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public List<UpgradeRequest> pending() {
        return repository.findByStatusOrderByCreatedAtAsc(UpgradeRequestStatus.PENDING);
    }

    @Transactional(readOnly = true)
    public List<UpgradeRequest> all() {
        return repository.findAllByOrderByCreatedAtDesc();
    }

    /**
     * Confirms the money arrived and moves the tenant onto the plan.
     *
     * @param amountReceived what actually landed, which may differ from the quote — a partial
     *                       transfer is recorded as what it was, not quietly rounded up to the
     *                       quote, so the invoice reflects reality.
     */
    public UpgradeRequest approve(Long requestId, BigDecimal amountReceived, String reference, String note) {
        UpgradeRequest request = require(requestId);
        if (!request.isOpen()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "This request has already been reviewed");
        }

        BigDecimal received = amountReceived != null ? amountReceived : request.getQuotedAmount();
        if (received.compareTo(BigDecimal.ZERO) < 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "amountReceived cannot be negative");
        }

        TenantSubscription subscription = subscriptionService.changePlan(
                request.getTenantId(),
                request.getRequestedPlanCode(),
                request.getRequestedPeriodDays(),
                request.getQuotedAmount(),
                SubscriptionSource.MANUAL_ADMIN,
                null,
                "Bank transfer, request #" + request.getId());

        SubscriptionInvoice invoice = billingService.issueSettled(
                subscription,
                subscription.getCurrentPeriodStart(),
                subscription.getCurrentPeriodEnd(),
                received,
                PaymentMethod.BANK_TRANSFER,
                blankTo(reference, request.getTransferReference()),
                CurrentActor.name());

        request.setStatus(UpgradeRequestStatus.APPROVED);
        request.setSettledAmount(received);
        request.setInvoiceId(invoice != null ? invoice.getId() : null);
        request.setReviewedBy(CurrentActor.name());
        request.setReviewedAt(Instant.now());
        request.setReviewNote(note);
        if (reference != null && !reference.isBlank()) {
            request.setTransferReference(reference.trim());
        }

        subscriptionService.audit(request.getTenantId(), "UPGRADE_APPROVED",
                "تمت الترقية إلى " + request.getRequestedPlanCode() + " بعد تأكيد تحويل " + received);
        return repository.save(request);
    }

    public UpgradeRequest reject(Long requestId, String reason) {
        UpgradeRequest request = require(requestId);
        if (!request.isOpen()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "This request has already been reviewed");
        }
        request.setStatus(UpgradeRequestStatus.REJECTED);
        request.setReviewedBy(CurrentActor.name());
        request.setReviewedAt(Instant.now());
        request.setReviewNote(reason);
        subscriptionService.audit(request.getTenantId(), "UPGRADE_REJECTED",
                reason != null ? reason : "تم رفض طلب الترقية");
        return repository.save(request);
    }

    private UpgradeRequest require(Long id) {
        return repository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Request not found: " + id));
    }

    private String blankTo(String value, String fallback) {
        return value == null || value.isBlank() ? fallback : value.trim();
    }
}
