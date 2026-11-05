package com.caffio.shift;

import com.caffio.debt.repository.DebtRepository;
import com.caffio.employee.repository.EmployeeTransactionRepository;
import com.caffio.expense.repository.ExpenseRepository;
import com.caffio.order.repository.OrderItemRepository;
import com.caffio.order.repository.OrderRepository;
import com.caffio.payment.repository.PaymentRepository;
import com.caffio.register.entity.Register;
import com.caffio.register.repository.RegisterRepository;
import com.caffio.shift.dto.CloseShiftRequest;
import com.caffio.shift.entity.Shift;
import com.caffio.shift.repository.ShiftRepository;
import com.caffio.user.entity.Role;
import com.caffio.user.entity.User;
import com.caffio.user.repository.UserRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.Optional;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class ShiftServiceOwnershipTest {
    @Mock ShiftRepository shiftRepository;
    @Mock UserRepository userRepository;
    @Mock RegisterRepository registerRepository;
    @Mock PaymentRepository paymentRepository;
    @Mock ExpenseRepository expenseRepository;
    @Mock OrderItemRepository orderItemRepository;
    @Mock OrderRepository orderRepository;
    @Mock DebtRepository debtRepository;
    @Mock EmployeeTransactionRepository employeeTransactionRepository;
    @InjectMocks ShiftService service;

    @Test
    void currentShiftNeverFallsBackToAnotherCashier() {
        when(shiftRepository.findByUserIdAndClosedAtIsNull(22L)).thenReturn(Optional.empty());

        assertTrue(service.findCurrentForUser(22L).isEmpty());
        verify(shiftRepository, never()).findAllByClosedAtIsNull();
    }

    @Test
    void cashierCannotCloseAnotherCashiersShift() {
        User owner = user(10L, Role.CASHIER);
        User requester = user(22L, Role.CASHIER);
        Shift shift = shift(3L, owner);
        when(shiftRepository.findById(3L)).thenReturn(Optional.of(shift));
        when(userRepository.findById(22L)).thenReturn(Optional.of(requester));

        ResponseStatusException error = assertThrows(ResponseStatusException.class,
                () -> service.close(3L, 22L, new CloseShiftRequest(BigDecimal.ZERO, BigDecimal.ZERO, null)));

        assertEquals(403, error.getStatusCode().value());
        verify(shiftRepository, never()).save(any());
    }

    @Test
    void ownerCannotCloseWhileOrdersAreStillOpen() {
        User owner = user(10L, Role.CASHIER);
        Shift shift = shift(3L, owner);
        when(shiftRepository.findById(3L)).thenReturn(Optional.of(shift));
        when(userRepository.findById(10L)).thenReturn(Optional.of(owner));
        when(orderRepository.findAllByShiftIdAndStatusIn(eq(3L), any())).thenReturn(List.of(
                com.caffio.order.entity.Order.builder().shift(shift).build()));

        ResponseStatusException error = assertThrows(ResponseStatusException.class,
                () -> service.close(3L, 10L, new CloseShiftRequest(BigDecimal.ZERO, BigDecimal.ZERO, null)));

        assertEquals(409, error.getStatusCode().value());
        assertTrue(error.getReason().contains("طلب مفتوح أو معلق"));
    }

    private User user(Long id, Role role) {
        User user = User.builder().username("user" + id).role(role).build();
        ReflectionTestUtils.setField(user, "id", id);
        return user;
    }

    private Shift shift(Long id, User owner) {
        Register register = Register.builder().name("Main").build();
        ReflectionTestUtils.setField(register, "id", 1L);
        Shift shift = Shift.builder().user(owner).register(register).openedAt(Instant.now())
                .openingFloat(BigDecimal.ZERO).build();
        ReflectionTestUtils.setField(shift, "id", id);
        return shift;
    }
}
