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

    /**
     * Every invoice on the platform, newest first. This is the list an operator needs to chase
     * money; until now the only way in was one tenant at a time, so nothing on the console could
     * answer "what is outstanding right now".
     */
    @GetMapping("/invoices")
    public org.springframework.data.domain.Page<com.example.cafemangmentsystem.billing.dto.AdminInvoiceDto> invoiceConsole(
            @RequestParam(name = "status", required = false) com.example.cafemangmentsystem.billing.entity.InvoiceStatus status,
            @RequestParam(name = "page", defaultValue = "0") int page,
            @RequestParam(name = "size", defaultValue = "25") int size) {
        return billingService.invoiceConsole(status,
                org.springframework.data.domain.PageRequest.of(Math.max(0, page), Math.min(Math.max(1, size), 200)));
    }

    @GetMapping("/tenants/{tenantId}/invoices")
    public List<com.example.cafemangmentsystem.billing.dto.AdminInvoiceDto> invoices(@PathVariable Long tenantId) {
        return billingService.invoiceDtosFor(tenantId);
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
