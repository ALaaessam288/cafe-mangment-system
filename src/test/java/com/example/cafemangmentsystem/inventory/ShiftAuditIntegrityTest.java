package com.example.cafemangmentsystem.inventory;

import com.example.cafemangmentsystem.inventory.dto.ShiftClosingAuditRequest;
import com.example.cafemangmentsystem.inventory.dto.ShiftOpeningAuditRequest;
import com.example.cafemangmentsystem.inventory.entity.ProductRecipe;
import com.example.cafemangmentsystem.inventory.entity.ShiftAuditItem;
import com.example.cafemangmentsystem.inventory.entity.ShiftAuditRecord;
import com.example.cafemangmentsystem.inventory.repository.ProductRecipeRepository;
import com.example.cafemangmentsystem.inventory.repository.ShiftAuditItemRepository;
import com.example.cafemangmentsystem.inventory.repository.ShiftAuditRecordRepository;
import com.example.cafemangmentsystem.menu.entity.Product;
import com.example.cafemangmentsystem.menu.repository.ProductRepository;
import com.example.cafemangmentsystem.order.repository.OrderItemRepository;
import com.example.cafemangmentsystem.shift.entity.Shift;
import com.example.cafemangmentsystem.shift.repository.ShiftRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

/** The stocktake must never invent or destroy stock on its own. */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class ShiftAuditIntegrityTest {

    @Mock ShiftAuditItemRepository auditItemRepository;
    @Mock ProductRecipeRepository recipeRepository;
    @Mock ShiftAuditRecordRepository auditRecordRepository;
    @Mock ProductRepository productRepository;
    @Mock ShiftRepository shiftRepository;
    @Mock OrderItemRepository orderItemRepository;
    @Mock RawMaterialLedgerService rawMaterialLedgerService;

    private ShiftAuditService service;
    private Shift shift;
    private ShiftAuditItem beans;
    private ShiftAuditItem syrup;

    @BeforeEach
    void setUp() {
        service = new ShiftAuditService(auditItemRepository, recipeRepository, auditRecordRepository,
                productRepository, shiftRepository, rawMaterialLedgerService, orderItemRepository);

        shift = new Shift();
        shift.setId(5L);
        when(shiftRepository.findById(5L)).thenReturn(Optional.of(shift));

        beans = ShiftAuditItem.builder().name("Coffee beans").unit("g").stockQuantity(1000.0).build();
        beans.setId(1L);
        syrup = ShiftAuditItem.builder().name("Vanilla syrup").unit("ml").stockQuantity(700.0).build();
        syrup.setId(2L);

        when(auditRecordRepository.save(any(ShiftAuditRecord.class))).thenAnswer(i -> i.getArgument(0));
        when(auditItemRepository.save(any(ShiftAuditItem.class))).thenAnswer(i -> i.getArgument(0));
    }

    private ShiftAuditRecord record(ShiftAuditItem item, double opening, double sold) {
        ShiftAuditRecord r = new ShiftAuditRecord();
        r.setShift(shift);
        r.setAuditItem(item);
        r.setOpeningCount(opening);
        r.setSoldDeductionCount(sold);
        return r;
    }

    // ── closing ───────────────────────────────────────────────────────────────

    @Test
    void anIngredientNobodyCountedIsLeftAloneRatherThanZeroed() {
        // The syrup was deactivated mid-shift, so the closing screen never listed it and the
        // client sent no count for it. It still has 700 ml in the store room.
        when(auditRecordRepository.findAllByShiftId(5L))
                .thenReturn(List.of(record(beans, 1000.0, 200.0), record(syrup, 700.0, 0.0)));

        service.recordShiftClosing(5L, new ShiftClosingAuditRequest(Map.of(1L, 780.0)));

        assertEquals(780.0, beans.getStockQuantity(), "the counted item is written down as counted");
        assertEquals(700.0, syrup.getStockQuantity(),
                "an uncounted item must keep its stock - a missing count is a gap, not a loss");
    }

    @Test
    void anUncountedIngredientProducesNoFabricatedVariance() {
        ShiftAuditRecord syrupRecord = record(syrup, 700.0, 0.0);
        when(auditRecordRepository.findAllByShiftId(5L)).thenReturn(List.of(syrupRecord));

        var result = service.recordShiftClosing(5L, new ShiftClosingAuditRequest(Map.of()));

        assertTrue(result.isEmpty(), "nothing was counted, so there is nothing to report");
        assertNull(syrupRecord.getVarianceCount(), "700 ml must not be booked as waste");
    }

    @Test
    void aCountedIngredientStillReportsItsVariance() {
        when(auditRecordRepository.findAllByShiftId(5L)).thenReturn(List.of(record(beans, 1000.0, 200.0)));

        service.recordShiftClosing(5L, new ShiftClosingAuditRequest(Map.of(1L, 780.0)));

        // Expected 800 g left, counted 780 g: 20 g unaccounted for.
        assertEquals(780.0, beans.getStockQuantity());
    }

    @Test
    void aNegativeClosingCountIsRefused() {
        when(auditRecordRepository.findAllByShiftId(5L)).thenReturn(List.of(record(beans, 1000.0, 0.0)));

        assertThrows(ResponseStatusException.class,
                () -> service.recordShiftClosing(5L, new ShiftClosingAuditRequest(Map.of(1L, -5.0))));
    }

    // ── opening ───────────────────────────────────────────────────────────────

    @Test
    void aSecondOpeningAuditForTheSameShiftIsRefused() {
        when(auditRecordRepository.findAllByShiftId(5L)).thenReturn(List.of(record(beans, 1000.0, 0.0)));

        ResponseStatusException ex = assertThrows(ResponseStatusException.class,
                () -> service.recordShiftOpening(5L, new ShiftOpeningAuditRequest(Map.of(1L, 999.0))));

        assertEquals(HttpStatus.CONFLICT, ex.getStatusCode());
        assertEquals(1000.0, beans.getStockQuantity(), "the refused call must not have written anything");
    }

    @Test
    void theFirstOpeningAuditIsAccepted() {
        when(auditRecordRepository.findAllByShiftId(5L)).thenReturn(List.of());
        when(auditItemRepository.findAllByActiveTrueAndRequiresAuditTrue()).thenReturn(List.of(beans));

        service.recordShiftOpening(5L, new ShiftOpeningAuditRequest(Map.of(1L, 950.0)));

        assertEquals(950.0, beans.getStockQuantity());
    }

    // ── restocking through a product ──────────────────────────────────────────

    @Test
    void aRawQuantityCannotBeAppliedToAMultiIngredientRecipe() {
        Product latte = Product.builder().nameAr("لاتيه").build();
        latte.setId(11L);
        when(recipeRepository.findAllByProductId(11L)).thenReturn(List.of(
                ProductRecipe.builder().product(latte).auditItem(beans).deductionQuantity(20.0).build(),
                ProductRecipe.builder().product(latte).auditItem(syrup).deductionQuantity(15.0).build()));

        // "I bought 250 g" names one thing; it used to add 250 to the beans AND 250 to the syrup.
        assertThrows(ResponseStatusException.class,
                () -> service.replenishRecipeStock(latte, null, 250.0));

        assertEquals(1000.0, beans.getStockQuantity());
        assertEquals(700.0, syrup.getStockQuantity(), "no stock may be invented");
    }

    @Test
    void aRawQuantityOnASingleIngredientRecipeIsFine() {
        Product espresso = Product.builder().nameAr("إسبريسو").build();
        espresso.setId(10L);
        when(recipeRepository.findAllByProductId(10L)).thenReturn(List.of(
                ProductRecipe.builder().product(espresso).auditItem(beans).deductionQuantity(20.0).build()));

        assertTrue(service.replenishRecipeStock(espresso, null, 250.0));
        assertEquals(1250.0, beans.getStockQuantity());
    }

    @Test
    void aPieceQuantityScalesEachIngredientByItsOwnRecipe() {
        Product latte = Product.builder().nameAr("لاتيه").build();
        latte.setId(11L);
        when(recipeRepository.findAllByProductId(11L)).thenReturn(List.of(
                ProductRecipe.builder().product(latte).auditItem(beans).deductionQuantity(20.0).build(),
                ProductRecipe.builder().product(latte).auditItem(syrup).deductionQuantity(15.0).build()));

        // Ten lattes' worth: 200 g of beans and 150 ml of syrup, not 10 of each.
        assertTrue(service.replenishRecipeStock(latte, 10, null));
        assertEquals(1200.0, beans.getStockQuantity());
        assertEquals(850.0, syrup.getStockQuantity());
    }
}
