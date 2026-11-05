package com.caffio.cashmovement;

import com.caffio.cashmovement.dto.CashDrawerSummaryDto;
import com.caffio.cashmovement.dto.CashMovementRequest;
import com.caffio.cashmovement.dto.CashMovementResponse;
import com.caffio.cashmovement.entity.CashMovement;
import com.caffio.cashmovement.entity.CashMovementType;
import com.caffio.cashmovement.repository.CashMovementRepository;
import com.caffio.debt.repository.DebtRepository;
import com.caffio.employee.repository.EmployeeTransactionRepository;
import com.caffio.expense.repository.ExpenseRepository;
import com.caffio.payment.entity.PaymentMethod;
import com.caffio.payment.repository.PaymentRepository;
import com.caffio.register.entity.Register;
import com.caffio.register.repository.RegisterRepository;
import com.caffio.shift.entity.Shift;
import com.caffio.shift.repository.ShiftRepository;
import com.caffio.user.entity.User;
import com.caffio.user.repository.UserRepository;
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
public class CashMovementService {

    private final CashMovementRepository cashMovementRepository;
    private final ShiftRepository shiftRepository;
    private final UserRepository userRepository;
    private final RegisterRepository registerRepository;
    private final PaymentRepository paymentRepository;
    private final ExpenseRepository expenseRepository;
    private final DebtRepository debtRepository;
    private final EmployeeTransactionRepository employeeTransactionRepository;

    public CashMovementResponse record(Long userId, CashMovementRequest request) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));

        Shift shift;
        if (request.shiftId() != null) {
            shift = shiftRepository.findById(request.shiftId())
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Shift not found"));
        } else {
            shift = shiftRepository.findByUserIdAndClosedAtIsNull(userId)
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "لا يوجد شيفت مفتوح حالياً لتسجيل حركة نقدية"));
        }

        if (shift.getClosedAt() != null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "لا يمكن تسجيل حركة نقدية على شيفت مغلق");
        }

        Register register = shift.getRegister();
        if (request.registerId() != null) {
            register = registerRepository.findById(request.registerId()).orElse(register);
        }

        String receiptNumber = "CSH-" + shift.getId() + "-" + (System.currentTimeMillis() % 1000000);

        CashMovement movement = CashMovement.builder()
                .shift(shift)
                .register(register)
                .performedBy(user)
                .type(request.type())
                .amount(request.amount())
                .reason(request.reason())
                .receiptNumber(receiptNumber)
                .performedAt(Instant.now())
                .build();

        CashMovement saved = cashMovementRepository.save(movement);
        return CashMovementResponse.from(saved);
    }

    @Transactional(readOnly = true)
    public List<CashMovementResponse> listByShift(Long shiftId) {
        return cashMovementRepository.findAllByShiftIdOrderByPerformedAtDesc(shiftId)
                .stream()
                .map(CashMovementResponse::from)
                .toList();
    }

    @Transactional(readOnly = true)
    public CashDrawerSummaryDto getCashSummary(Long shiftId) {
        Shift shift = shiftRepository.findById(shiftId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Shift not found"));

        BigDecimal openingFloat = shift.getOpeningFloat() != null ? shift.getOpeningFloat() : BigDecimal.ZERO;
        BigDecimal cashSales = paymentRepository.sumAmountByShiftIdAndMethod(shiftId, PaymentMethod.CASH);
        if (cashSales == null) cashSales = BigDecimal.ZERO;

        BigDecimal cashIn = cashMovementRepository.sumAmountByShiftIdAndType(shiftId, CashMovementType.CASH_IN);
        if (cashIn == null) cashIn = BigDecimal.ZERO;

        BigDecimal safeDrops = cashMovementRepository.sumAmountByShiftIdAndType(shiftId, CashMovementType.SAFE_DROP);
        if (safeDrops == null) safeDrops = BigDecimal.ZERO;

        BigDecimal cashOut = cashMovementRepository.sumAmountByShiftIdAndType(shiftId, CashMovementType.CASH_OUT);
        if (cashOut == null) cashOut = BigDecimal.ZERO;

        BigDecimal cashExpenses = expenseRepository.sumDrawerAmountByShiftId(shiftId);
        if (cashExpenses == null) cashExpenses = BigDecimal.ZERO;

        BigDecimal debtCollected = BigDecimal.ZERO;
        BigDecimal employeePaidOut = BigDecimal.ZERO;

        // Expected Cash = Float + Cash Sales + Cash In + Debt Collected - Safe Drops - Cash Out - Cash Expenses
        BigDecimal expectedCash = openingFloat
                .add(cashSales)
                .add(cashIn)
                .add(debtCollected)
                .subtract(safeDrops)
                .subtract(cashOut)
                .subtract(cashExpenses)
                .subtract(employeePaidOut);

        List<CashMovementResponse> recentMovements = listByShift(shiftId);

        return new CashDrawerSummaryDto(
                shiftId,
                openingFloat,
                cashSales,
                cashIn,
                safeDrops,
                cashOut,
                cashExpenses,
                debtCollected,
                employeePaidOut,
                expectedCash,
                recentMovements
        );
    }
}
