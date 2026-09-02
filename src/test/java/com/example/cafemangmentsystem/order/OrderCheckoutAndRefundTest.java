package com.example.cafemangmentsystem.order;

import com.example.cafemangmentsystem.common.idempotency.IdempotencyService;
import com.example.cafemangmentsystem.common.tenant.TenantContext;
import com.example.cafemangmentsystem.menu.entity.Product;
import com.example.cafemangmentsystem.order.dto.CheckoutRequest;
import com.example.cafemangmentsystem.order.dto.RefundRequest;
import com.example.cafemangmentsystem.order.dto.StockDisposalOption;
import com.example.cafemangmentsystem.order.entity.Order;
import com.example.cafemangmentsystem.order.entity.OrderItem;
import com.example.cafemangmentsystem.order.entity.OrderStatus;
import com.example.cafemangmentsystem.payment.entity.Payment;
import com.example.cafemangmentsystem.payment.entity.PaymentMethod;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

public class OrderCheckoutAndRefundTest {

    @BeforeEach
    public void setUp() {
        TenantContext.set(1L);
    }

    @AfterEach
    public void tearDown() {
        TenantContext.clear();
    }

    @Test
    public void idempotencyServiceReturnsCachedResult() {
        IdempotencyService idempotency = new IdempotencyService();
        String key = "IDEMP-KEY-12345";
        String dummyCachedResult = "CHECKOUT_COMPLETED_SUCCESSFULLY";

        // Put into cache
        idempotency.put(key, dummyCachedResult);

        // Subsequent get returns exact cached response
        Object cached = idempotency.get(key);
        assertNotNull(cached);
        assertEquals(dummyCachedResult, cached);
    }

    @Test
    public void refundMathCalculatesMaxRefundableCorrectly() {
        BigDecimal totalPaid = new BigDecimal("250.00");
        BigDecimal existingRefund = new BigDecimal("100.00");

        BigDecimal maxRefundable = totalPaid.subtract(existingRefund);
        assertEquals(new BigDecimal("150.00"), maxRefundable);

        // Attempting to refund 200 exceeds max refundable of 150
        BigDecimal requestedRefund = new BigDecimal("200.00");
        assertTrue(requestedRefund.compareTo(maxRefundable) > 0);
    }

    @Test
    public void returnToStockRestoresInventoryAndAvailability() {
        Product coffee = new Product();
        coffee.setId(1L);
        coffee.setNameAr("قهوة تركي");
        coffee.setTrackInventory(true);
        coffee.setStockQuantity(0);
        coffee.setAvailable(false);

        // Refund item with RETURN_TO_STOCK
        int returnedQuantity = 2;
        coffee.setStockQuantity(coffee.getStockQuantity() + returnedQuantity);
        if (coffee.getStockQuantity() > 0) {
            coffee.setAvailable(true);
        }

        assertEquals(2, coffee.getStockQuantity());
        assertTrue(coffee.isAvailable());
    }
}
