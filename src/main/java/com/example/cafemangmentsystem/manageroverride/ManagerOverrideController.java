package com.example.cafemangmentsystem.manageroverride;

import com.example.cafemangmentsystem.billing.RequiresFeature;
import com.example.cafemangmentsystem.billing.entity.Feature;
import com.example.cafemangmentsystem.manageroverride.dto.ManagerOverrideResponse;
import com.example.cafemangmentsystem.manageroverride.dto.VerifyOverrideRequest;
import com.example.cafemangmentsystem.security.UserPrincipal;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * Supervisor authorisation for restricted till actions.
 *
 * <p>The gate is per-method, not on the class. Voiding an item already sent to the kitchen goes
 * through {@code /verify}, and the POS blocks that action behind this dialog — so gating the whole
 * controller meant a cashier on TRIAL or STARTER could not cancel a sent item at all. Authorising a
 * void is part of running a till, not a premium add-on.
 *
 * <p>What the plan sells is the <em>audit trail</em>: the searchable history of who overrode what.
 */
@RestController
@RequestMapping("/api/manager-overrides")
@RequiredArgsConstructor
public class ManagerOverrideController {

    private final ManagerOverrideService managerOverrideService;

    @PostMapping("/verify")
    @ResponseStatus(HttpStatus.OK)
    @PreAuthorize("hasAnyRole('ADMIN', 'SUPERVISOR', 'CASHIER')")
    public ManagerOverrideResponse verifyOverride(
            @AuthenticationPrincipal UserPrincipal principal,
            @Valid @RequestBody VerifyOverrideRequest request
    ) {
        return managerOverrideService.verifyAndRecord(principal.getId(), request);
    }

    @GetMapping
    @RequiresFeature(Feature.MANAGER_OVERRIDE)
    @PreAuthorize("hasAnyRole('ADMIN', 'SUPERVISOR')")
    public List<ManagerOverrideResponse> listAll() {
        return managerOverrideService.listAll();
    }

    @GetMapping("/shift/{shiftId}")
    @RequiresFeature(Feature.MANAGER_OVERRIDE)
    @PreAuthorize("hasAnyRole('ADMIN', 'SUPERVISOR')")
    public List<ManagerOverrideResponse> listByShift(@PathVariable Long shiftId) {
        return managerOverrideService.listByShift(shiftId);
    }
}
