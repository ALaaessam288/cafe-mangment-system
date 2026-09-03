package com.example.cafemangmentsystem.debt;

import com.example.cafemangmentsystem.billing.RequiresFeature;
import com.example.cafemangmentsystem.billing.entity.Feature;
import com.example.cafemangmentsystem.debt.dto.DebtRequest;
import com.example.cafemangmentsystem.debt.dto.DebtResponse;
import com.example.cafemangmentsystem.debt.dto.SettleDebtRequest;
import com.example.cafemangmentsystem.security.UserPrincipal;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RequiresFeature(Feature.DEBTS)
@RestController
@RequestMapping("/api/debts")
@RequiredArgsConstructor
@PreAuthorize("hasAnyRole('ADMIN', 'SUPERVISOR')")
public class DebtController {

    private final DebtService debtService;

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public DebtResponse create(@AuthenticationPrincipal UserPrincipal principal, @Valid @RequestBody DebtRequest request) {
        return debtService.create(principal.getId(), request);
    }

    @GetMapping
    public List<DebtResponse> findAll() {
        return debtService.findAll();
    }

    @PutMapping("/{id}/settle")
    public DebtResponse settle(@PathVariable Long id, @AuthenticationPrincipal UserPrincipal principal,
                                @RequestBody(required = false) SettleDebtRequest request) {
        return debtService.settle(principal.getId(), id, request != null ? request : new SettleDebtRequest(false, null, null));
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable Long id) {
        debtService.delete(id);
    }
}