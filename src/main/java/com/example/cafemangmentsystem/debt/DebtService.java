package com.example.cafemangmentsystem.debt;

import com.example.cafemangmentsystem.debt.dto.DebtRequest;
import com.example.cafemangmentsystem.debt.dto.DebtResponse;
import com.example.cafemangmentsystem.debt.dto.SettleDebtRequest;
import com.example.cafemangmentsystem.debt.entity.Debt;
import com.example.cafemangmentsystem.debt.repository.DebtRepository;
import com.example.cafemangmentsystem.expense.ExpenseService;
import com.example.cafemangmentsystem.expense.dto.ExpenseRequest;
import com.example.cafemangmentsystem.expense.entity.ExpenseType;
import com.example.cafemangmentsystem.menu.entity.RevenueLine;
import com.example.cafemangmentsystem.user.entity.User;
import com.example.cafemangmentsystem.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

@Service
@RequiredArgsConstructor
@Transactional
public class DebtService {

    private final DebtRepository debtRepository;
    private final UserRepository userRepository;
    private final ExpenseService expenseService;

    public DebtResponse create(Long userId, DebtRequest request) {
        User recordedBy = userRepository.findById(userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));

        Debt debt = Debt.builder()
                .creditorName(request.creditorName())
                .amount(request.amount())
                .notes(request.notes())
                .debtDate(request.debtDate() != null ? request.debtDate() : LocalDate.now())
                .dueDate(request.dueDate())
                .recordedBy(recordedBy)
                .build();

        return DebtResponse.from(debtRepository.save(debt));
    }

    @Transactional(readOnly = true)
    public List<DebtResponse> findAll() {
        return debtRepository.findAllByOrderByDebtDateDesc().stream().map(DebtResponse::from).toList();
    }

    public DebtResponse settle(Long userId, Long debtId, SettleDebtRequest request) {
        Debt debt = debtRepository.findById(debtId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Debt not found: " + debtId));

        if (debt.isSettled()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Debt is already fully settled");
        }

        BigDecimal currentPaid = debt.getPaidAmount() != null ? debt.getPaidAmount() : BigDecimal.ZERO;
        BigDecimal remaining = debt.getAmount().subtract(currentPaid);

        BigDecimal paymentAmount = (request != null && request.amount() != null && request.amount().compareTo(BigDecimal.ZERO) > 0)
                ? request.amount()
                : remaining;

        if (paymentAmount.compareTo(remaining) > 0) {
            paymentAmount = remaining;
        }

        BigDecimal newPaid = currentPaid.add(paymentAmount);
        debt.setPaidAmount(newPaid);

        boolean paidFromDrawer = request != null && Boolean.TRUE.equals(request.paidFromDrawer());
        debt.setPaidFromDrawer(paidFromDrawer);

        if (newPaid.compareTo(debt.getAmount()) >= 0) {
            debt.setSettled(true);
            debt.setSettledAt(Instant.now());
        }

        // Settling from the drawer is a real cash outflow - record it as an expense for the actually paid amount
        if (paidFromDrawer && paymentAmount.compareTo(BigDecimal.ZERO) > 0) {
            String note = (request != null && request.notes() != null && !request.notes().isBlank())
                    ? request.notes()
                    : "سداد مديونية: " + debt.getCreditorName() + (debt.isSettled() ? " (بالكامل)" : " (جزء: " + paymentAmount + ")");
            expenseService.create(userId, new ExpenseRequest(
                    ExpenseType.DEBTS,
                    RevenueLine.SHARED,
                    paymentAmount,
                    LocalDate.now(),
                    false,
                    true,
                    null,
                    note
            ));
        }

        return DebtResponse.from(debtRepository.save(debt));
    }

    public void delete(Long id) {
        Debt debt = debtRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Debt not found: " + id));
        debtRepository.delete(debt);
    }
}