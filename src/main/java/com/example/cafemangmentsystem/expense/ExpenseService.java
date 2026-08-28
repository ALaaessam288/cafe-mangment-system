package com.example.cafemangmentsystem.expense;

import com.example.cafemangmentsystem.employee.entity.Employee;
import com.example.cafemangmentsystem.employee.repository.EmployeeRepository;
import com.example.cafemangmentsystem.expense.dto.ExpenseRequest;
import com.example.cafemangmentsystem.expense.dto.ExpenseResponse;
import com.example.cafemangmentsystem.expense.dto.SettleExpenseRequest;
import com.example.cafemangmentsystem.expense.entity.Expense;
import com.example.cafemangmentsystem.expense.entity.ExpenseStatus;
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

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

@Service
@RequiredArgsConstructor
@Transactional
public class ExpenseService {

    private final ExpenseRepository expenseRepository;
    private final ShiftRepository shiftRepository;
    private final UserRepository userRepository;
    private final EmployeeRepository employeeRepository;

    public ExpenseResponse create(Long userId, ExpenseRequest request) {
        User recordedBy = userRepository.findById(userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));

        Shift shift = null;
        if (request.paidFromDrawer()) {
            shift = shiftRepository.findByUserIdAndClosedAtIsNull(userId).orElse(null);
            if (shift == null) {
                List<Shift> openShifts = shiftRepository.findAllByClosedAtIsNull();
                if (!openShifts.isEmpty()) {
                    shift = openShifts.get(openShifts.size() - 1);
                } else {
                    throw new ResponseStatusException(HttpStatus.CONFLICT,
                            "يجب فتح شيفت أولاً لصرف أي مبلغ من الخزينة");
                }
            }
        }

        Employee employee = null;
        if (request.employeeId() != null) {
            employee = employeeRepository.findById(request.employeeId())
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Employee not found"));
        }

        boolean isAdvance = request.isAdvance();
        ExpenseStatus status = isAdvance ? ExpenseStatus.PENDING_SETTLEMENT : ExpenseStatus.COMPLETED;
        BigDecimal advanceAmt = request.amount();
        BigDecimal actualAmt = isAdvance ? null : request.amount();
        BigDecimal returnedAmt = isAdvance ? null : BigDecimal.ZERO;

        String spender = request.spenderName();
        if ((spender == null || spender.isBlank()) && employee != null) {
            spender = employee.getName() != null ? employee.getName() : employee.getFullName();
        }

        Expense expense = Expense.builder()
                .type(request.type())
                .revenueLine(request.revenueLine())
                .status(status)
                .amount(request.amount())
                .advanceAmount(advanceAmt)
                .actualAmount(actualAmt)
                .returnedAmount(returnedAmt)
                .isAdvance(isAdvance)
                .expenseDate(request.expenseDate())
                .recurring(request.recurring())
                .paidFromDrawer(request.paidFromDrawer())
                .notes(request.notes())
                .shift(shift)
                .employee(employee)
                .spenderName(spender)
                .recordedBy(recordedBy)
                .build();

        return ExpenseResponse.from(expenseRepository.save(expense));
    }

    public ExpenseResponse settleAdvance(Long userId, Long expenseId, SettleExpenseRequest request) {
        User settledBy = userRepository.findById(userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));

        Expense expense = expenseRepository.findById(expenseId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "المصروف غير موجود: " + expenseId));

        if (expense.getStatus() != ExpenseStatus.PENDING_SETTLEMENT) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "هذه العُهدة تم تسويتها بالفعل سابقاً");
        }

        BigDecimal actualAmt = request.actualAmount();
        BigDecimal advanceAmt = expense.getAdvanceAmount() != null ? expense.getAdvanceAmount() : expense.getAmount();
        BigDecimal returnedAmt = advanceAmt.subtract(actualAmt);

        expense.setActualAmount(actualAmt);
        expense.setReturnedAmount(returnedAmt);
        expense.setAmount(actualAmt); // Update net expense in DB to the actual spent amount!
        expense.setStatus(ExpenseStatus.COMPLETED);
        expense.setSettledAt(Instant.now());
        expense.setSettledBy(settledBy);

        if (request.notes() != null && !request.notes().trim().isEmpty()) {
            String existingNotes = expense.getNotes() != null ? expense.getNotes() + " | " : "";
            expense.setNotes(existingNotes + "تم التسوية: " + request.notes());
        }

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