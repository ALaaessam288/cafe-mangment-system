package com.example.cafemangmentsystem.order;

import com.example.cafemangmentsystem.cafetable.repository.CafeTableRepository;
import com.example.cafemangmentsystem.discount.repository.DiscountRepository;
import com.example.cafemangmentsystem.inventory.ShiftAuditService;
import com.example.cafemangmentsystem.menu.entity.Product;
import com.example.cafemangmentsystem.menu.repository.ProductOptionRepository;
import com.example.cafemangmentsystem.menu.repository.ProductRepository;
import com.example.cafemangmentsystem.order.entity.OrderItem;
import com.example.cafemangmentsystem.order.repository.OrderItemRepository;
import com.example.cafemangmentsystem.order.repository.OrderRepository;
import com.example.cafemangmentsystem.payment.repository.PaymentRepository;
import com.example.cafemangmentsystem.printing.PrintJobService;
import com.example.cafemangmentsystem.register.repository.RegisterRepository;
import com.example.cafemangmentsystem.shift.repository.ShiftRepository;
import com.example.cafemangmentsystem.tenant.repository.TenantRepository;
import com.example.cafemangmentsystem.user.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.web.server.ResponseStatusException;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class OrderServiceInventoryTest {
    @Mock OrderRepository orderRepository;
    @Mock OrderItemRepository orderItemRepository;
    @Mock CafeTableRepository cafeTableRepository;
    @Mock ProductRepository productRepository;
    @Mock RegisterRepository registerRepository;
    @Mock ShiftRepository shiftRepository;
    @Mock UserRepository userRepository;
    @Mock PaymentRepository paymentRepository;
    @Mock PrintJobService printJobService;
    @Mock DiscountRepository discountRepository;
    @Mock TenantRepository tenantRepository;
    @Mock ProductOptionRepository productOptionRepository;
    @Mock ShiftAuditService shiftAuditService;
    @InjectMocks OrderService service;

    private Product product;

    @BeforeEach
    void setUp() {
        product = Product.builder().nameAr("Beans").trackInventory(true)
                .stockQuantity(10).reservedQuantity(0).available(true).build();
    }

    @Test
    void reservesWithoutDeductingPhysicalStock() {
        invoke("reserveStock", product, 3);
        assertEquals(10, product.getStockQuantity());
        assertEquals(3, product.getReservedQuantity());
        verify(productRepository).save(product);
    }

    @Test
    void reservationPreventsOverselling() {
        product.setReservedQuantity(8);
        assertThrows(ResponseStatusException.class, () -> invoke("reserveStock", product, 3));
        assertEquals(8, product.getReservedQuantity());
        verify(productRepository, never()).save(any());
    }

    @Test
    void sendingConsumesStockAndReservationExactlyOnce() {
        product.setReservedQuantity(3);
        OrderItem item = OrderItem.builder().product(product).quantity(3).build();
        invoke("consumeStock", item);
        assertEquals(7, product.getStockQuantity());
        assertEquals(0, product.getReservedQuantity());
    }

    @Test
    void sendingRejectsStockThatChangedBelowRequiredQuantity() {
        OrderItem item = OrderItem.builder().product(product).quantity(11).build();
        assertThrows(ResponseStatusException.class, () -> invoke("consumeStock", item));
        assertEquals(10, product.getStockQuantity());
    }

    @Test
    void zeroStockMakesTrackedProductUnavailable() {
        OrderItem item = OrderItem.builder().product(product).quantity(10).build();
        invoke("consumeStock", item);
        assertEquals(0, product.getStockQuantity());
        assertFalse(product.isAvailable());
    }

    @Test
    void untrackedProductsAreNeverChanged() {
        product.setTrackInventory(false);
        OrderItem item = OrderItem.builder().product(product).quantity(4).build();
        invoke("reserveStock", product, 4);
        invoke("consumeStock", item);
        invoke("releaseStock", item);
        assertEquals(10, product.getStockQuantity());
        assertEquals(0, product.getReservedQuantity());
        verify(productRepository, never()).save(any());
    }

    @Test
    void cancellationRestoresConsumedStock() {
        product.setStockQuantity(7);
        OrderItem item = OrderItem.builder().product(product).quantity(3).build();
        invoke("releaseStock", item);
        assertEquals(10, product.getStockQuantity());
        verify(productRepository).save(product);
    }

    private void invoke(String method, Object... args) {
        ReflectionTestUtils.invokeMethod(service, method, args);
    }
}
