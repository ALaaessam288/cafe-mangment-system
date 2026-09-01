package com.example.cafemangmentsystem.cashmovement;

import com.example.cafemangmentsystem.cashmovement.dto.CashDrawerSummaryDto;
import com.example.cafemangmentsystem.cashmovement.dto.CashMovementRequest;
import com.example.cafemangmentsystem.cashmovement.dto.CashMovementResponse;
import com.example.cafemangmentsystem.security.UserPrincipal;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/cash-movements")
@RequiredArgsConstructor
public class CashMovementController {

    private final CashMovementService cashMovementService;

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasAnyRole('ADMIN', 'SUPERVISOR', 'CASHIER')")
    public CashMovementResponse record(
            @AuthenticationPrincipal UserPrincipal principal,
            @Valid @RequestBody CashMovementRequest request
    ) {
        return cashMovementService.record(principal.getId(), request);
    }

    @GetMapping("/shift/{shiftId}")
    @PreAuthorize("hasAnyRole('ADMIN', 'SUPERVISOR', 'CASHIER')")
    public List<CashMovementResponse> listByShift(@PathVariable Long shiftId) {
        return cashMovementService.listByShift(shiftId);
    }

    @GetMapping("/shift/{shiftId}/summary")
    @PreAuthorize("hasAnyRole('ADMIN', 'SUPERVISOR', 'CASHIER')")
    public CashDrawerSummaryDto getCashSummary(@PathVariable Long shiftId) {
        return cashMovementService.getCashSummary(shiftId);
    }
}
