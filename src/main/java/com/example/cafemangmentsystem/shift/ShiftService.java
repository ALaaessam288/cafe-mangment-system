package com.example.cafemangmentsystem.shift;

import com.example.cafemangmentsystem.expense.repository.ExpenseRepository;
import com.example.cafemangmentsystem.payment.entity.PaymentMethod;
import com.example.cafemangmentsystem.payment.repository.PaymentRepository;
import com.example.cafemangmentsystem.register.entity.Register;
import com.example.cafemangmentsystem.register.repository.RegisterRepository;
import com.example.cafemangmentsystem.shift.dto.CloseShiftRequest;
import com.example.cafemangmentsystem.shift.dto.OpenShiftRequest;
import com.example.cafemangmentsystem.shift.dto.ShiftReportResponse;
import com.example.cafemangmentsystem.shift.dto.ShiftResponse;
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
import java.util.Optional;

@Service
@RequiredArgsConstructor
@Transactional
public class ShiftService {

    private final ShiftRepository shiftRepository;
    private final UserRepository userRepository;
    private final RegisterRepository registerRepository;
    private final PaymentRepository paymentRepository;
    private final ExpenseRepository expenseRepository;

    public ShiftResponse open(Long userId, OpenShiftRequest request) {
        if (shiftRepository.existsByUserIdAndClosedAtIsNull(userId)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "User already has an open shift");
        }

        Register register = registerRepository.findById(request.registerId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Register not found: " + request.registerId()));
        if (!register.isActive()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Register is not active: " + request.registerId());
        }
        if (shiftRepository.existsByRegisterIdAndClosedAtIsNull(register.getId())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Register already has an open shift");
        }

        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found: " + userId));

        Shift shift = Shift.builder()
                .user(user)
                .register(register)
                .openedAt(Instant.now())
                .openingFloat(request.openingFloat())
                .build();

        return ShiftResponse.from(shiftRepository.save(shift));
    }

    public ShiftResponse close(Long shiftId, Long requestingUserId, CloseShiftRequest request) {
        Shift shift = getOrThrow(shiftId);

        if (!shift.getUser().getId().equals(requestingUserId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "You can only close your own shift");
        }

        return closeInternal(shift, request);
    }

    public ShiftResponse forceClose(Long shiftId, CloseShiftRequest request) {
        return closeInternal(getOrThrow(shiftId), request);
    }

    private ShiftResponse closeInternal(Shift shift, CloseShiftRequest request) {
        if (shift.getClosedAt() != null) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Shift is already closed");
        }

        BigDecimal cashCollected = paymentRepository.sumAmountByShiftIdAndMethod(shift.getId(), PaymentMethod.CASH);
        BigDecimal drawerExpenses = expenseRepository.sumDrawerAmountByShiftId(shift.getId());
        shift.setExpectedCash(shift.getOpeningFloat().add(cashCollected).subtract(drawerExpenses));
        shift.setCountedCash(request.countedCash());
        shift.setVariance(request.countedCash().subtract(shift.getExpectedCash()));
        shift.setClosedAt(Instant.now());

        return ShiftResponse.from(shift);
    }

    @Transactional(readOnly = true)
    public ShiftResponse findById(Long id) {
        return ShiftResponse.from(getOrThrow(id));
    }

    @Transactional(readOnly = true)
    public List<ShiftResponse> findAll(boolean openOnly) {
        List<Shift> shifts = openOnly ? shiftRepository.findAllByClosedAtIsNull() : shiftRepository.findAll();
        return shifts.stream().map(ShiftResponse::from).toList();
    }

    @Transactional(readOnly = true)
    public Optional<ShiftResponse> findCurrentForUser(Long userId) {
        return shiftRepository.findByUserIdAndClosedAtIsNull(userId).map(ShiftResponse::from);
    }

    @Transactional(readOnly = true)
    public ShiftReportResponse getShiftReport(Long shiftId) {
        ShiftResponse shiftResponse = ShiftResponse.from(getOrThrow(shiftId));

        BigDecimal cash = paymentRepository.sumAmountByShiftIdAndMethod(shiftId, PaymentMethod.CASH);
        BigDecimal instapay = paymentRepository.sumAmountByShiftIdAndMethod(shiftId, PaymentMethod.INSTAPAY);
        BigDecimal wallet = paymentRepository.sumAmountByShiftIdAndMethod(shiftId, PaymentMethod.WALLET);
        
        BigDecimal totalRevenue = cash.add(instapay).add(wallet);

        return new ShiftReportResponse(shiftResponse, totalRevenue, cash, instapay, wallet);
    }

    Shift getOrThrow(Long id) {
        return shiftRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Shift not found: " + id));
    }
}