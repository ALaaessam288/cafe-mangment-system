package com.example.cafemangmentsystem.expense;

import com.example.cafemangmentsystem.expense.dto.ExpenseRequest;
import com.example.cafemangmentsystem.expense.dto.ExpenseResponse;
import com.example.cafemangmentsystem.expense.entity.Expense;
import com.example.cafemangmentsystem.expense.repository.ExpenseRepository;
import com.example.cafemangmentsystem.shift.entity.Shift;
import com.example.cafemangmentsystem.shift.repository.ShiftRepository;
import com.example.cafemangmentsystem.user.entity.User;
import com.example.cafemangmentsystem.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

@Service
@RequiredArgsConstructor
@Transactional
public class ExpenseService {

    private final ExpenseRepository expenseRepository;
    private final ShiftRepository shiftRepository;
    private final UserRepository userRepository;

    public ExpenseResponse create(Long userId, ExpenseRequest request) {
        User recordedBy = userRepository.findById(userId).orElseThrow();

        Shift shift = null;
        if (request.paidFromDrawer()) {
            shift = shiftRepository.findByUserIdAndClosedAtIsNull(userId)
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.CONFLICT,
                            "You must have an open shift to pay an expense from the drawer"));
        }

        Expense expense = Expense.builder()
                .type(request.type())
                .revenueLine(request.revenueLine())
                .amount(request.amount())
                .expenseDate(request.expenseDate())
                .recurring(request.recurring())
                .paidFromDrawer(request.paidFromDrawer())
                .shift(shift)
                .recordedBy(recordedBy)
                .build();

        return ExpenseResponse.from(expenseRepository.save(expense));
    }

    @Transactional(readOnly = true)
    public List<ExpenseResponse> findAll() {
        return expenseRepository.findAll().stream().map(ExpenseResponse::from).toList();
    }

    @Transactional(readOnly = true)
    public ExpenseResponse findById(Long id) {
        return ExpenseResponse.from(expenseRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Expense not found: " + id)));
    }
}