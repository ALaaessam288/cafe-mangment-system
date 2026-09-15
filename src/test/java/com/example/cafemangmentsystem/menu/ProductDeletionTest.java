package com.example.cafemangmentsystem.menu;

import com.example.cafemangmentsystem.billing.QuotaService;
import com.example.cafemangmentsystem.inventory.ShiftAuditService;
import com.example.cafemangmentsystem.inventory.repository.ProductRecipeRepository;
import com.example.cafemangmentsystem.menu.entity.Product;
import com.example.cafemangmentsystem.menu.repository.CategoryRepository;
import com.example.cafemangmentsystem.menu.repository.ProductOptionRepository;
import com.example.cafemangmentsystem.menu.repository.ProductRepository;
import com.example.cafemangmentsystem.order.entity.OrderItem;
import com.example.cafemangmentsystem.station.repository.StationRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

/**
 * Deleting a product is now unconditional, which only works because an order line does not depend
 * on its product row. These tests pin the half of that claim that lives in Java: a line whose
 * product has been deleted still reports everything a bill needs.
 */
@ExtendWith(MockitoExtension.class)
class ProductDeletionTest {

    @Mock ProductRepository productRepository;
    @Mock CategoryRepository categoryRepository;
    @Mock StationRepository stationRepository;
    @Mock QuotaService quotaService;
    @Mock ShiftAuditService shiftAuditService;
    @Mock ProductOptionRepository productOptionRepository;
    @Mock ProductRecipeRepository productRecipeRepository;
    @InjectMocks ProductService service;

    private Product product;

    @BeforeEach
    void setUp() {
        product = Product.builder().nameAr("قهوة تركي").build();
        lenient().when(productRepository.findById(7L)).thenReturn(Optional.of(product));
        lenient().when(productOptionRepository.findAllByProductId(7L)).thenReturn(List.of());
        lenient().when(productRecipeRepository.findAllByProductId(7L)).thenReturn(List.of());
    }

    @Test
    void aProductIsDeletedWithItsOptionsAndRecipe() {
        service.delete(7L);

        verify(productOptionRepository).deleteAll(any());
        verify(productRecipeRepository).deleteAll(any());
        verify(productRepository).delete(product);
    }

    @Test
    void havingBeenSoldNoLongerBlocksTheDelete() {
        // The old behaviour threw CONFLICT here. order_items is now ON DELETE SET NULL, so the
        // sale keeps its snapshots and the product may go.
        assertDoesNotThrow(() -> service.delete(7L));
        verify(productRepository).delete(product);
    }

    @Test
    void anOrderLineStillPricesItselfAfterItsProductIsDeleted() {
        OrderItem orphan = OrderItem.builder()
                .product(null)
                .productNameSnapshot("قهوة تركي")
                .unitPriceSnapshot(new BigDecimal("25.00"))
                .quantity(3)
                .discountAmount(BigDecimal.ZERO)
                .build();

        // This is the whole argument for allowing the delete: the money is in the snapshot.
        assertNull(orphan.getProduct());
        assertEquals("قهوة تركي", orphan.getProductNameSnapshot());
        assertEquals(new BigDecimal("75.00"),
                orphan.getUnitPriceSnapshot().multiply(BigDecimal.valueOf(orphan.getQuantity())));
    }
}
