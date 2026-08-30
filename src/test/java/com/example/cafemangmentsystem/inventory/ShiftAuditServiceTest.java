package com.example.cafemangmentsystem.inventory;

import com.example.cafemangmentsystem.inventory.entity.ProductRecipe;
import com.example.cafemangmentsystem.inventory.entity.ShiftAuditItem;
import com.example.cafemangmentsystem.inventory.repository.ProductRecipeRepository;
import com.example.cafemangmentsystem.inventory.repository.ShiftAuditItemRepository;
import com.example.cafemangmentsystem.inventory.repository.ShiftAuditRecordRepository;
import com.example.cafemangmentsystem.menu.entity.Product;
import com.example.cafemangmentsystem.menu.repository.ProductRepository;
import com.example.cafemangmentsystem.order.entity.Order;
import com.example.cafemangmentsystem.order.entity.OrderItem;
import com.example.cafemangmentsystem.order.entity.OrderItemStatus;
import com.example.cafemangmentsystem.order.repository.OrderItemRepository;
import com.example.cafemangmentsystem.shift.repository.ShiftRepository;
import com.example.cafemangmentsystem.shift.entity.Shift;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.mockito.Mockito.lenient;
import static org.mockito.ArgumentMatchers.any;

@ExtendWith(MockitoExtension.class)
class ShiftAuditServiceTest {

    @Mock ShiftAuditItemRepository auditItemRepository;
    @Mock ProductRecipeRepository recipeRepository;
    @Mock ShiftAuditRecordRepository auditRecordRepository;
    @Mock ProductRepository productRepository;
    @Mock ShiftRepository shiftRepository;
    @Mock OrderItemRepository orderItemRepository;
    @Mock Product product;

    private ShiftAuditService service;
    private Order order;
    private ShiftAuditItem ingredient;
    private OrderItem item;

    @BeforeEach
    void setUp() {
        service = new ShiftAuditService(auditItemRepository, recipeRepository, auditRecordRepository,
                productRepository, shiftRepository, orderItemRepository);
        order = Order.builder().build();
        ingredient = ShiftAuditItem.builder().name("Coffee beans").unit("g").stockQuantity(100.0).build();
        item = OrderItem.builder().product(product).quantity(2).status(OrderItemStatus.SENT).build();
        ProductRecipe recipe = ProductRecipe.builder()
                .product(product)
                .auditItem(ingredient)
                .deductionQuantity(10.0)
                .build();
        lenient().when(product.getId()).thenReturn(7L);
        lenient().when(recipeRepository.findAllByProductId(7L)).thenReturn(List.of(recipe));
        lenient().when(auditRecordRepository.save(any())).thenAnswer(invocation -> invocation.getArgument(0));
    }

    @Test
    void deductsOnlyTheItemsExplicitlyBeingSent() {
        service.deductRecipeInventoryOnItems(order, List.of(item));

        assertEquals(80.0, ingredient.getStockQuantity());
        verify(auditItemRepository).save(ingredient);
        verify(orderItemRepository, never()).findAllByOrderId(org.mockito.ArgumentMatchers.any());
    }

    @Test
    void rejectsIngredientOversellingInsteadOfClampingToZero() {
        ingredient.setStockQuantity(15.0);

        assertThrows(ResponseStatusException.class,
                () -> service.deductRecipeInventoryOnItems(order, List.of(item)));
        assertEquals(15.0, ingredient.getStockQuantity());
        verify(auditItemRepository, never()).save(ingredient);
    }

    @Test
    void restoresRecipeInventoryWhenASentItemIsCancelled() {
        ingredient.setStockQuantity(80.0);

        service.restoreRecipeInventoryForItem(order, item);

        assertEquals(100.0, ingredient.getStockQuantity());
        verify(auditItemRepository).save(ingredient);
    }

    @Test
    void supportsFractionalRecipeQuantities() {
        ProductRecipe fractional = ProductRecipe.builder()
                .product(product).auditItem(ingredient).deductionQuantity(2.5).build();
        when(recipeRepository.findAllByProductId(7L)).thenReturn(List.of(fractional));
        item.setQuantity(3);

        service.deductRecipeInventoryOnItems(order, List.of(item));

        assertEquals(92.5, ingredient.getStockQuantity());
    }

    @Test
    void productWithoutRecipeDoesNotChangeIngredients() {
        when(recipeRepository.findAllByProductId(7L)).thenReturn(List.of());

        service.deductRecipeInventoryOnItems(order, List.of(item));

        assertEquals(100.0, ingredient.getStockQuantity());
        verify(auditItemRepository, never()).save(ingredient);
    }

    @Test
    void rejectsUnrealisticOpeningStockBeforeSavingAnything() {
        ReflectionTestUtils.setField(ingredient, "id", 12L);
        when(shiftRepository.findById(5L)).thenReturn(java.util.Optional.of(Shift.builder().build()));
        when(auditItemRepository.findAllByActiveTrueAndRequiresAuditTrue()).thenReturn(List.of(ingredient));
        var request = new com.example.cafemangmentsystem.inventory.dto.ShiftOpeningAuditRequest(
                java.util.Map.of(12L, 50_000_000_000.0));

        assertThrows(ResponseStatusException.class, () -> service.recordShiftOpening(5L, request));

        assertEquals(100.0, ingredient.getStockQuantity());
        verify(auditItemRepository, never()).save(ingredient);
    }

    @Test
    void acceptsRealisticOpeningStock() {
        ReflectionTestUtils.setField(ingredient, "id", 12L);
        when(shiftRepository.findById(5L)).thenReturn(java.util.Optional.of(Shift.builder().build()));
        when(auditItemRepository.findAllByActiveTrueAndRequiresAuditTrue()).thenReturn(List.of(ingredient));
        var request = new com.example.cafemangmentsystem.inventory.dto.ShiftOpeningAuditRequest(
                java.util.Map.of(12L, 1_000.0));

        service.recordShiftOpening(5L, request);

        assertEquals(1_000.0, ingredient.getStockQuantity());
        verify(auditItemRepository).save(ingredient);
    }

    @Test
    void allowsExactlyTheNumberOfProductsTheRecipeCanProduce() {
        ingredient.setStockQuantity(1_000.0);
        ProductRecipe tenGramsPerCup = ProductRecipe.builder()
                .product(product).auditItem(ingredient).deductionQuantity(10.0).build();
        when(recipeRepository.findAllByProductId(7L)).thenReturn(List.of(tenGramsPerCup));
        when(orderItemRepository.sumNewQuantityByProductId(7L)).thenReturn(0L);

        service.validateRecipeAvailability(product, 100);
    }

    @Test
    void rejectsOneMoreProductThanTheRecipeCanProduce() {
        ingredient.setStockQuantity(1_000.0);
        ProductRecipe tenGramsPerCup = ProductRecipe.builder()
                .product(product).auditItem(ingredient).deductionQuantity(10.0).build();
        when(recipeRepository.findAllByProductId(7L)).thenReturn(List.of(tenGramsPerCup));
        when(orderItemRepository.sumNewQuantityByProductId(7L)).thenReturn(0L);

        ResponseStatusException error = assertThrows(ResponseStatusException.class,
                () -> service.validateRecipeAvailability(product, 101));

        org.junit.jupiter.api.Assertions.assertTrue(error.getReason().contains("Only 100"));
    }

    @Test
    void existingNewTicketsReduceWhatCanStillBeAdded() {
        ingredient.setStockQuantity(1_000.0);
        ProductRecipe tenGramsPerCup = ProductRecipe.builder()
                .product(product).auditItem(ingredient).deductionQuantity(10.0).build();
        when(recipeRepository.findAllByProductId(7L)).thenReturn(List.of(tenGramsPerCup));
        when(orderItemRepository.sumNewQuantityByProductId(7L)).thenReturn(90L);

        service.validateRecipeAvailability(product, 10);
        ResponseStatusException error = assertThrows(ResponseStatusException.class,
                () -> service.validateRecipeAvailability(product, 11));
        org.junit.jupiter.api.Assertions.assertTrue(error.getReason().contains("Only 10"));
    }
}
