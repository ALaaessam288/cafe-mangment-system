package com.example.cafemangmentsystem.shift;

import com.example.cafemangmentsystem.expense.repository.ExpenseRepository;
import com.example.cafemangmentsystem.order.entity.Order;
import com.example.cafemangmentsystem.order.entity.OrderStatus;
import com.example.cafemangmentsystem.order.repository.OrderRepository;
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
    private final OrderRepository orderRepository;

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
    public ShiftReportResponse generateReport(Long shiftId) {
        Shift shift = getOrThrow(shiftId);

        List<Order> orders = orderRepository.findAllByShiftId(shiftId);
        List<Order> voidedOrders = orders.stream().filter(o -> o.getStatus() == OrderStatus.VOIDED).toList();
        List<Order> countedOrders = orders.stream().filter(o -> o.getStatus() != OrderStatus.VOIDED).toList();

        BigDecimal grossSales = countedOrders.stream().map(Order::getSubtotal).reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal totalDiscount = countedOrders.stream().map(Order::getDiscount).reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal netSales = countedOrders.stream().map(Order::getTotal).reduce(BigDecimal.ZERO, BigDecimal::add);

        BigDecimal cashCollected = paymentRepository.sumAmountByShiftIdAndMethod(shiftId, PaymentMethod.CASH);
        BigDecimal walletCollected = paymentRepository.sumAmountByShiftIdAndMethod(shiftId, PaymentMethod.WALLET);
        BigDecimal instapayCollected = paymentRepository.sumAmountByShiftIdAndMethod(shiftId, PaymentMethod.INSTAPAY);
        BigDecimal totalCollected = cashCollected.add(walletCollected).add(instapayCollected);

        BigDecimal drawerExpenses = expenseRepository.sumDrawerAmountByShiftId(shiftId);
        BigDecimal expectedCash = shift.getClosedAt() != null
                ? shift.getExpectedCash()
                : shift.getOpeningFloat().add(cashCollected).subtract(drawerExpenses);

        return new ShiftReportResponse(
                shift.getId(),
                shift.getUser().getId(),
                shift.getUser().getFullName(),
                shift.getRegister().getId(),
                shift.getRegister().getName(),
                shift.getOpenedAt(),
                shift.getClosedAt(),
                countedOrders.size(),
                voidedOrders.size(),
                grossSales,
                totalDiscount,
                netSales,
                cashCollected,
                walletCollected,
                instapayCollected,
                totalCollected,
                drawerExpenses,
                shift.getOpeningFloat(),
                expectedCash,
                shift.getCountedCash(),
                shift.getVariance());
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

    Shift getOrThrow(Long id) {
        return shiftRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Shift not found: " + id));
    }
}