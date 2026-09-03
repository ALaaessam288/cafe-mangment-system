package com.example.cafemangmentsystem.expense;

import com.example.cafemangmentsystem.billing.RequiresFeature;
import com.example.cafemangmentsystem.billing.entity.Feature;
import com.example.cafemangmentsystem.expense.dto.ExpenseRequest;
import com.example.cafemangmentsystem.expense.dto.ExpenseResponse;
import com.example.cafemangmentsystem.expense.dto.SettleExpenseRequest;
import com.example.cafemangmentsystem.security.UserPrincipal;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RequiresFeature(Feature.EXPENSES)
@RestController
@RequestMapping("/api/expenses")
@RequiredArgsConstructor
@PreAuthorize("hasAnyRole('ADMIN','CASHIER','SUPERVISOR')")
public class ExpenseController {

    private final ExpenseService expenseService;

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public ExpenseResponse create(@AuthenticationPrincipal UserPrincipal principal, @Valid @RequestBody ExpenseRequest request) {
        return expenseService.create(principal.getId(), request);
    }

    @PutMapping("/{id}/settle")
    public ExpenseResponse settleAdvance(
            @AuthenticationPrincipal UserPrincipal principal,
            @PathVariable Long id,
            @Valid @RequestBody SettleExpenseRequest request
    ) {
        return expenseService.settleAdvance(principal.getId(), id, request);
    }

    @GetMapping
    public List<ExpenseResponse> findAll() {
        return expenseService.findAll();
    }

    @GetMapping("/{id}")
    public ExpenseResponse findById(@PathVariable Long id) {
        return expenseService.findById(id);
    }
}