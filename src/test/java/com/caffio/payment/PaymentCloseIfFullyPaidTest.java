package com.caffio.payment;

import com.caffio.order.OrderService;
import com.caffio.order.entity.Order;
import com.caffio.order.entity.OrderStatus;
import com.caffio.payment.dto.RecordPaymentRequest;
import com.caffio.payment.entity.PaymentMethod;
import com.caffio.payment.repository.PaymentRepository;
import com.caffio.user.entity.User;
import com.caffio.user.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Paying and closing happen in one transaction when the client asks for it, so a failed close can
 * no longer leave money recorded against an order that is still open.
 */
@ExtendWith(MockitoExtension.class)
class PaymentCloseIfFullyPaidTest {

    @Mock PaymentRepository paymentRepository;
    @Mock OrderService orderService;
    @Mock UserRepository userRepository;
    @InjectMocks PaymentService paymentService;

    private Order order;

    @BeforeEach
    void setUp() {
        order = new Order();
        order.setId(9L);
        order.setStatus(OrderStatus.SERVED);
        order.setTotal(new BigDecimal("100.00"));
        when(orderService.getOrThrow(9L)).thenReturn(order);
        when(paymentRepository.sumAmountByOrderId(9L)).thenReturn(BigDecimal.ZERO);
        when(userRepository.findById(3L)).thenReturn(Optional.of(new User()));
    }

    private RecordPaymentRequest card(String amount, Boolean closeIfFullyPaid) {
        return new RecordPaymentRequest(PaymentMethod.CARD, new BigDecimal(amount), null, null, null, closeIfFullyPaid);
    }

    @Test
    void closesTheOrderWhenThePaymentSettlesItAndTheClientAsked() {
        paymentService.record(9L, 3L, card("100.00", true));

        assertEquals(OrderStatus.PAID, order.getStatus());
        verify(orderService).close(9L, 3L);
    }

    @Test
    void leavesAPartPaymentOpenEvenWhenTheClientAsked() {
        paymentService.record(9L, 3L, card("40.00", true));

        assertEquals(OrderStatus.SERVED, order.getStatus());
        verify(orderService, never()).close(any(), any());
        verify(orderService).toResponse(order);
    }

    @Test
    void oldClientsThatDoNotSendTheFlagStillGetPaidButNotClosed() {
        paymentService.record(9L, 3L, card("100.00", null));

        assertEquals(OrderStatus.PAID, order.getStatus());
        verify(orderService, never()).close(any(), any());
    }
}
