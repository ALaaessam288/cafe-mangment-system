package com.example.cafemangmentsystem.menu;

import com.example.cafemangmentsystem.billing.QuotaService;
import com.example.cafemangmentsystem.inventory.ShiftAuditService;
import com.example.cafemangmentsystem.inventory.repository.ProductRecipeRepository;
import com.example.cafemangmentsystem.inventory.repository.StockAdjustmentRepository;
import com.example.cafemangmentsystem.menu.entity.Product;
import com.example.cafemangmentsystem.menu.repository.CategoryRepository;
import com.example.cafemangmentsystem.menu.repository.ProductOptionRepository;
import com.example.cafemangmentsystem.menu.repository.ProductRepository;
import com.example.cafemangmentsystem.order.repository.OrderItemRepository;
import com.example.cafemangmentsystem.station.repository.StationRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

/**
 * Deleting a menu item is the one destructive action on the products screen, and it used to lie:
 * any failure was swallowed and turned into a deactivation that still reported success. These
 * tests pin the honest contract - delete when it is safe, refuse and say why when it is not.
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
    @Mock OrderItemRepository orderItemRepository;
    @Mock StockAdjustmentRepository stockAdjustmentRepository;
    @InjectMocks ProductService service;

    private Product product;

    @BeforeEach
    void setUp() {
        product = Product.builder().nameAr("قهوة تركي").build();
        lenient().when(productRepository.findById(7L)).thenReturn(Optional.of(product));
    }

    @Test
    void aProductThatWasNeverSoldIsDeletedWithItsOptionsAndRecipe() {
        when(orderItemRepository.existsByProductId(7L)).thenReturn(false);
        when(stockAdjustmentRepository.existsByProductId(7L)).thenReturn(false);
        when(productOptionRepository.findAllByProductId(7L)).thenReturn(List.of());
        when(productRecipeRepository.findAllByProductId(7L)).thenReturn(List.of());

        service.delete(7L);

        verify(productOptionRepository).deleteAll(any());
        verify(productRecipeRepository).deleteAll(any());
        verify(productRepository).delete(product);
    }

    @Test
    void aProductThatWasSoldIsRefusedRatherThanQuietlyDeactivated() {
        when(orderItemRepository.existsByProductId(7L)).thenReturn(true);

        ResponseStatusException refusal =
                assertThrows(ResponseStatusException.class, () -> service.delete(7L));

        assertEquals(HttpStatus.CONFLICT, refusal.getStatusCode());
        // The old behaviour: no delete, but a save() that hid the refusal behind a "success".
        verify(productRepository, never()).delete(any());
        verify(productRepository, never()).save(any());
        assertTrue(product.isActive(), "refusing to delete must not deactivate behind the caller's back");
    }

    @Test
    void stockHistoryAlonePinsAProductDownEvenIfItNeverSold() {
        when(orderItemRepository.existsByProductId(7L)).thenReturn(false);
        when(stockAdjustmentRepository.existsByProductId(7L)).thenReturn(true);

        ResponseStatusException refusal =
                assertThrows(ResponseStatusException.class, () -> service.delete(7L));

        assertEquals(HttpStatus.CONFLICT, refusal.getStatusCode());
        verify(productRepository, never()).delete(any());
    }
}
