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

@RequiresFeature(Feature.MANAGER_OVERRIDE)
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
    @PreAuthorize("hasAnyRole('ADMIN', 'SUPERVISOR')")
    public List<ManagerOverrideResponse> listAll() {
        return managerOverrideService.listAll();
    }

    @GetMapping("/shift/{shiftId}")
    @PreAuthorize("hasAnyRole('ADMIN', 'SUPERVISOR')")
    public List<ManagerOverrideResponse> listByShift(@PathVariable Long shiftId) {
        return managerOverrideService.listByShift(shiftId);
    }
}
