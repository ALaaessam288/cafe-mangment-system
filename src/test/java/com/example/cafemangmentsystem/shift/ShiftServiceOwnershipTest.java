package com.example.cafemangmentsystem.shift;

import com.example.cafemangmentsystem.debt.repository.DebtRepository;
import com.example.cafemangmentsystem.employee.repository.EmployeeTransactionRepository;
import com.example.cafemangmentsystem.expense.repository.ExpenseRepository;
import com.example.cafemangmentsystem.order.repository.OrderItemRepository;
import com.example.cafemangmentsystem.order.repository.OrderRepository;
import com.example.cafemangmentsystem.payment.repository.PaymentRepository;
import com.example.cafemangmentsystem.register.entity.Register;
import com.example.cafemangmentsystem.register.repository.RegisterRepository;
import com.example.cafemangmentsystem.shift.dto.CloseShiftRequest;
import com.example.cafemangmentsystem.shift.entity.Shift;
import com.example.cafemangmentsystem.shift.repository.ShiftRepository;
import com.example.cafemangmentsystem.user.entity.Role;
import com.example.cafemangmentsystem.user.entity.User;
import com.example.cafemangmentsystem.user.repository.UserRepository;
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
        when(orderRepository.existsByShiftIdAndStatusIn(eq(3L), any())).thenReturn(true);

        ResponseStatusException error = assertThrows(ResponseStatusException.class,
                () -> service.close(3L, 10L, new CloseShiftRequest(BigDecimal.ZERO, BigDecimal.ZERO, null)));

        assertEquals(409, error.getStatusCode().value());
        assertTrue(error.getReason().contains("open or unpaid"));
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
