package com.example.cafemangmentsystem.inventory;

import com.example.cafemangmentsystem.inventory.entity.ProductRecipe;
import com.example.cafemangmentsystem.inventory.entity.ShiftAuditItem;
import com.example.cafemangmentsystem.inventory.repository.ProductRecipeRepository;
import com.example.cafemangmentsystem.inventory.repository.ShiftAuditItemRepository;
import com.example.cafemangmentsystem.inventory.repository.ShiftAuditRecordRepository;
import com.example.cafemangmentsystem.menu.entity.Product;
import com.example.cafemangmentsystem.menu.repository.ProductRepository;
import com.example.cafemangmentsystem.order.repository.OrderItemRepository;
import com.example.cafemangmentsystem.shift.repository.ShiftRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.when;

/**
 * Two products sharing one ingredient.
 *
 * <p>250 g of beans at 20 g a cup is twelve cups, whether they are served as espresso or as latte.
 * Availability used to subtract a hold looked up per PRODUCT
 * ({@code sumNewQuantityByProductId}), so pending espressos were invisible when the question was
 * asked about lattes — and the ingredient they both consume is the same tin of beans. With ten
 * espressos pending the system offered twelve more lattes and accepted five of them, overselling
 * the beans by 50 g.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class SharedIngredientAvailabilityTest {

    @Mock ShiftAuditItemRepository auditItemRepository;
    @Mock ProductRecipeRepository recipeRepository;
    @Mock ShiftAuditRecordRepository auditRecordRepository;
    @Mock ProductRepository productRepository;
    @Mock ShiftRepository shiftRepository;
    @Mock OrderItemRepository orderItemRepository;
    @Mock RawMaterialLedgerService rawMaterialLedgerService;

    private ShiftAuditService service;
    private ShiftAuditItem beans;
    private ShiftAuditItem milk;
    private Product espresso;
    private Product latte;

    @BeforeEach
    void setUp() {
        service = new ShiftAuditService(auditItemRepository, recipeRepository, auditRecordRepository,
                productRepository, shiftRepository, rawMaterialLedgerService, orderItemRepository);

        beans = ShiftAuditItem.builder().name("Coffee beans").unit("g").stockQuantity(250.0).build();
        beans.setId(1L);
        milk = ShiftAuditItem.builder().name("Milk").unit("ml").stockQuantity(2000.0).build();
        milk.setId(2L);

        espresso = Product.builder().nameAr("إسبريسو").build();
        espresso.setId(10L);
        latte = Product.builder().nameAr("لاتيه").build();
        latte.setId(11L);

        when(recipeRepository.findAllByProductId(10L)).thenReturn(List.of(
                ProductRecipe.builder().product(espresso).auditItem(beans).deductionQuantity(20.0).build()));
        when(recipeRepository.findAllByProductId(11L)).thenReturn(List.of(
                ProductRecipe.builder().product(latte).auditItem(beans).deductionQuantity(20.0).build(),
                ProductRecipe.builder().product(latte).auditItem(milk).deductionQuantity(150.0).build()));
    }

    /** The repository reports the hold per ingredient, in that ingredient's own unit. */
    private void reserved(Map<Long, Double> byIngredient) {
        when(recipeRepository.sumReservedByIngredient()).thenReturn(
                byIngredient.entrySet().stream()
                        .map(e -> new Object[]{ e.getKey(), e.getValue() })
                        .toList());
    }

    @Test
    void withNothingPendingBothProductsSeeWhatTheBeansAllow() {
        reserved(Map.of());

        assertEquals(12, service.getRecipeAvailableQuantity(espresso));
        assertEquals(12, service.getRecipeAvailableQuantity(latte));
    }

    @Test
    void pendingEspressosReduceWhatIsLeftForLattes() {
        // Ten espressos on NEW tickets: 200 g of the 250 g is already spoken for.
        reserved(Map.of(1L, 200.0));

        assertEquals(2, service.getRecipeAvailableQuantity(espresso));
        assertEquals(2, service.getRecipeAvailableQuantity(latte),
                "the beans are the same beans - 50 g left is 2 more cups of anything");
    }

    @Test
    void theTotalAcceptedAcrossBothProductsCannotExceedWhatTheBeansAllow() {
        reserved(Map.of(1L, 200.0));

        assertThrows(ResponseStatusException.class,
                () -> service.validateRecipeAvailability(latte, 5),
                "5 lattes needs 100 g and only 50 g remains");
        assertDoesNotThrow(() -> service.validateRecipeAvailability(latte, 2));
    }

    @Test
    void theScarcestIngredientIsTheOneThatLimits() {
        // Beans allow 12 lattes; milk at 150 ml a cup allows 13. Beans should win.
        reserved(Map.of());
        assertEquals(12, service.getRecipeAvailableQuantity(latte));

        // Drop the milk and it becomes the constraint instead.
        milk.setStockQuantity(450.0);
        assertEquals(3, service.getRecipeAvailableQuantity(latte));
    }

    @Test
    void aHoldOnASecondIngredientAlsoConstrains() {
        // Beans free, but most of the milk is committed to pending lattes.
        reserved(Map.of(2L, 1850.0));
        assertEquals(1, service.getRecipeAvailableQuantity(latte));
        assertEquals(12, service.getRecipeAvailableQuantity(espresso),
                "espresso does not use milk, so a milk hold must not restrict it");
    }

    @Test
    void aProductWithNoRecipeIsNotConstrainedByIngredients() {
        Product bottledWater = Product.builder().nameAr("مياه").build();
        bottledWater.setId(12L);
        when(recipeRepository.findAllByProductId(12L)).thenReturn(List.of());
        reserved(Map.of());

        assertNull(service.getRecipeAvailableQuantity(bottledWater));
        assertDoesNotThrow(() -> service.validateRecipeAvailability(bottledWater, 99));
    }

    @Test
    void theBatchLookupAgreesWithTheSingleLookup() {
        reserved(Map.of(1L, 200.0));

        Map<Long, Integer> batch = service.getRecipeAvailableQuantities(List.of(espresso, latte));

        assertEquals(service.getRecipeAvailableQuantity(espresso), batch.get(10L));
        assertEquals(service.getRecipeAvailableQuantity(latte), batch.get(11L));
    }
}
