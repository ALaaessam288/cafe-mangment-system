package com.example.cafemangmentsystem.billing.web;

import com.example.cafemangmentsystem.billing.BillingService;
import com.example.cafemangmentsystem.billing.entity.PaymentMethod;
import com.example.cafemangmentsystem.billing.entity.SubscriptionInvoice;
import com.example.cafemangmentsystem.billing.entity.SubscriptionPayment;
import com.example.cafemangmentsystem.common.tenant.CurrentActor;
import jakarta.validation.constraints.NotNull;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

/** Invoices, payments and revenue — the reporting surface the platform never had. */
@RestController
@RequestMapping("/api/admin/billing")
@RequiredArgsConstructor
@PreAuthorize("hasRole('SUPER_ADMIN')")
public class BillingAdminController {

    private final BillingService billingService;

    @GetMapping("/stats")
    public Map<String, Object> stats() {
        return billingService.revenueStats();
    }

    @GetMapping("/tenants/{tenantId}/invoices")
    public List<SubscriptionInvoice> invoices(@PathVariable Long tenantId) {
        return billingService.invoicesFor(tenantId);
    }

    @GetMapping("/tenants/{tenantId}/payments")
    public List<SubscriptionPayment> payments(@PathVariable Long tenantId) {
        return billingService.paymentsFor(tenantId);
    }

    public record RecordPaymentRequest(
            @NotNull BigDecimal amount,
            PaymentMethod method,
            String reference,
            String notes
    ) {}

    @PostMapping("/invoices/{invoiceId}/payments")
    public SubscriptionPayment recordPayment(@PathVariable Long invoiceId,
                                             @RequestBody RecordPaymentRequest request) {
        return billingService.recordPayment(invoiceId, request.amount(),
                request.method() != null ? request.method() : PaymentMethod.CASH,
                request.reference(), CurrentActor.name(), request.notes());
    }

    public record VoidRequest(String reason) {}

    @PostMapping("/invoices/{invoiceId}/void")
    public SubscriptionInvoice voidInvoice(@PathVariable Long invoiceId,
                                           @RequestBody(required = false) VoidRequest request) {
        return billingService.voidInvoice(invoiceId, request != null ? request.reason() : null);
    }
}
