package com.example.cafemangmentsystem.order;

import com.example.cafemangmentsystem.order.entity.OrderStatus;
import com.example.cafemangmentsystem.order.repository.OrderRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.EnumSet;
import java.util.List;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.anyCollection;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * The POS polls this every 20 seconds, so it must stay bounded by what is on the floor rather than
 * growing with the café's whole order history.
 */
@ExtendWith(MockitoExtension.class)
class ActiveOrdersQueryTest {

    private static final Set<OrderStatus> LIVE =
            EnumSet.of(OrderStatus.OPEN, OrderStatus.SENT, OrderStatus.SERVED, OrderStatus.READY_FOR_PICKUP);

    @Mock OrderRepository orderRepository;
    @InjectMocks OrderService orderService;

    @Test
    void liveStatusesAreExactlyThoseThatCanStillTakeItemsOrPayments() {
        assertEquals(LIVE, OrderService.ACTIVE_STATUSES);
    }

    @Test
    void withoutATableItReadsOnlyLiveOrders() {
        when(orderRepository.findAllByStatusIn(LIVE)).thenReturn(List.of());

        orderService.findActive(null);

        verify(orderRepository).findAllByStatusIn(LIVE);
        verify(orderRepository, never()).findAll();
    }

    @Test
    void withATableItReadsOnlyThatTablesLiveOrder() {
        when(orderRepository.findByTableIdAndStatusIn(4L, LIVE)).thenReturn(List.of());

        orderService.findActive(4L);

        verify(orderRepository).findByTableIdAndStatusIn(4L, LIVE);
        verify(orderRepository, never()).findAllByStatusIn(anyCollection());
    }
}
