package com.example.cafemangmentsystem.billing.web;

import com.example.cafemangmentsystem.billing.BankTransferProperties;
import com.example.cafemangmentsystem.billing.UpgradeRequestService;
import com.example.cafemangmentsystem.billing.entity.UpgradeRequest;
import com.example.cafemangmentsystem.common.tenant.TenantContext;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Upgrading by bank transfer.
 *
 * <p>Both tenant routes sit under {@code /api/tenant/}, which the subscription guard exempts —
 * a café whose subscription has lapsed is exactly the one that needs to ask for an upgrade, and
 * blocking the request would leave it with no way out but a phone call.
 */
@RestController
@RequiredArgsConstructor
public class UpgradeRequestController {

    private final UpgradeRequestService service;
    private final BankTransferProperties bank;

    // ── Customer ────────────────────────────────────────────────────────────

    /** Where to send the money. Read by the upgrade screen before the customer transfers. */
    @GetMapping("/api/tenant/bank-details")
    public Map<String, Object> bankDetails() {
        Map<String, Object> details = new LinkedHashMap<>();
        details.put("configured", bank.isConfigured());
        details.put("bankName", bank.getBankName());
        details.put("accountName", bank.getAccountName());
        details.put("accountNumber", bank.getAccountNumber());
        details.put("iban", bank.getIban());
        details.put("swift", bank.getSwift());
        details.put("wallet", bank.getWallet());
        details.put("supportPhone", bank.getSupportPhone());
        details.put("instructions", bank.getInstructions());
        return details;
    }

    public record SubmitRequest(
            @NotBlank String planCode,
            Integer periodDays,
            @Size(max = 120) String contactName,
            @Size(max = 40) String contactPhone,
            @Size(max = 120) String transferReference,
            @Size(max = 500) String note
    ) {}

    @PostMapping("/api/tenant/upgrade-requests")
    @PreAuthorize("hasRole('ADMIN')")
    @ResponseStatus(HttpStatus.CREATED)
    public UpgradeRequest submit(@Valid @RequestBody SubmitRequest request) {
        return service.submit(TenantContext.get(), request.planCode(), request.periodDays(),
                request.contactName(), request.contactPhone(), request.transferReference(), request.note());
    }

    @GetMapping("/api/tenant/upgrade-requests")
    @PreAuthorize("hasRole('ADMIN')")
    public List<UpgradeRequest> mine() {
        return service.forTenant(TenantContext.get());
    }

    @PostMapping("/api/tenant/upgrade-requests/{id}/withdraw")
    @PreAuthorize("hasRole('ADMIN')")
    public UpgradeRequest withdraw(@PathVariable Long id) {
        return service.withdraw(TenantContext.get(), id);
    }

    // ── Platform ────────────────────────────────────────────────────────────

    @GetMapping("/api/admin/upgrade-requests")
    @PreAuthorize("hasRole('SUPER_ADMIN')")
    public List<UpgradeRequest> all(@RequestParam(defaultValue = "false") boolean pendingOnly) {
        return pendingOnly ? service.pending() : service.all();
    }

    public record ApproveRequest(BigDecimal amountReceived, String reference, String note) {}

    /** Confirms the transfer landed, moves the tenant onto the plan, and raises a settled invoice. */
    @PostMapping("/api/admin/upgrade-requests/{id}/approve")
    @PreAuthorize("hasRole('SUPER_ADMIN')")
    public UpgradeRequest approve(@PathVariable Long id, @RequestBody(required = false) ApproveRequest body) {
        return service.approve(id,
                body != null ? body.amountReceived() : null,
                body != null ? body.reference() : null,
                body != null ? body.note() : null);
    }

    public record RejectRequest(String reason) {}

    @PostMapping("/api/admin/upgrade-requests/{id}/reject")
    @PreAuthorize("hasRole('SUPER_ADMIN')")
    public UpgradeRequest reject(@PathVariable Long id, @RequestBody(required = false) RejectRequest body) {
        return service.reject(id, body != null ? body.reason() : null);
    }
}
