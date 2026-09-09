package com.example.cafemangmentsystem.inventory;

import com.example.cafemangmentsystem.common.tenant.TenantContext;
import com.example.cafemangmentsystem.inventory.dto.RawMaterialMovementDto;
import com.example.cafemangmentsystem.inventory.dto.RawMaterialMovementRequest;
import com.example.cafemangmentsystem.inventory.entity.RawMaterialMovement;
import com.example.cafemangmentsystem.inventory.entity.RawMaterialMovementType;
import com.example.cafemangmentsystem.inventory.entity.ShiftAuditItem;
import com.example.cafemangmentsystem.inventory.repository.RawMaterialMovementRepository;
import com.example.cafemangmentsystem.inventory.repository.ShiftAuditItemRepository;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

/**
 * The raw-material ledger.
 *
 * <p>Stock used to move by overwriting {@code shift_audit_items.stock_quantity}, so a delivery, a
 * spillage and a typo were indistinguishable afterwards and what a delivery cost was never captured.
 * These tests pin the two properties that matter: the balance and its record change together, and
 * a purchase carries its money.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class RawMaterialLedgerServiceTest {

    @Mock RawMaterialMovementRepository movementRepository;
    @Mock ShiftAuditItemRepository auditItemRepository;

    private RawMaterialLedgerService service;
    private ShiftAuditItem beans;

    @BeforeEach
    void setUp() {
        TenantContext.set(1L);
        service = new RawMaterialLedgerService(movementRepository, auditItemRepository);

        beans = ShiftAuditItem.builder().name("Coffee beans").unit("g").stockQuantity(1000.0).build();
        beans.setId(1L);
        beans.setCostPerUnit(0.20);

        when(auditItemRepository.findById(1L)).thenReturn(Optional.of(beans));
        when(auditItemRepository.save(any(ShiftAuditItem.class))).thenAnswer(i -> i.getArgument(0));
        when(movementRepository.save(any(RawMaterialMovement.class))).thenAnswer(i -> {
            RawMaterialMovement m = i.getArgument(0);
            m.setId(99L);
            return m;
        });
    }

    @AfterEach
    void tearDown() {
        TenantContext.clear();
    }

    private RawMaterialMovement saved() {
        ArgumentCaptor<RawMaterialMovement> c = ArgumentCaptor.forClass(RawMaterialMovement.class);
        verify(movementRepository).save(c.capture());
        return c.getValue();
    }

    // ── purchases ─────────────────────────────────────────────────────────────

    @Test
    void aDeliveryRaisesStockAndRecordsWhatItCost() {
        RawMaterialMovementDto dto = service.record(new RawMaterialMovementRequest(
                1L, RawMaterialMovementType.RESTOCK, 500.0, new BigDecimal("0.30"),
                "توريد أسبوعي", "INV-2201", null));

        assertEquals(1500.0, beans.getStockQuantity());

        RawMaterialMovement m = saved();
        assertEquals(500.0, m.getQuantityChange());
        assertEquals(1500.0, m.getResultingQuantity(), "the balance is stored, not replayed");
        assertEquals(new BigDecimal("150.00"), m.getTotalCost(), "500 × 0.30");
        assertEquals("INV-2201", m.getReference());
        assertNotNull(m.getPerformedBy(), "a movement nobody owns is not an audit trail");
        assertNotNull(dto.occurredAt());
    }

    @Test
    void buyingAtANewPriceMovesTheStandingCostByWeight() {
        // 1000 g already held at 0.20, plus 1000 g arriving at 0.40 → 0.30 across the lot.
        service.record(new RawMaterialMovementRequest(
                1L, RawMaterialMovementType.RESTOCK, 1000.0, new BigDecimal("0.40"), null, null, null));

        assertEquals(0.30, beans.getCostPerUnit(), 0.0001,
                "existing stock must not be revalued at today's price");
    }

    @Test
    void theFirstEverPurchaseSetsTheCostOutright() {
        beans.setCostPerUnit(0.0);
        beans.setStockQuantity(0.0);

        service.record(new RawMaterialMovementRequest(
                1L, RawMaterialMovementType.RESTOCK, 250.0, new BigDecimal("0.25"), null, null, null));

        assertEquals(0.25, beans.getCostPerUnit(), 0.0001);
    }

    @Test
    void aNegativeUnitCostIsRefused() {
        assertThrows(ResponseStatusException.class, () -> service.record(new RawMaterialMovementRequest(
                1L, RawMaterialMovementType.RESTOCK, 100.0, new BigDecimal("-1"), null, null, null)));
        assertEquals(1000.0, beans.getStockQuantity(), "a refused movement changes nothing");
    }

    // ── waste ─────────────────────────────────────────────────────────────────

    @Test
    void wasteIsSubtractedAndValuedAtTheStandingCost() {
        service.record(new RawMaterialMovementRequest(
                1L, RawMaterialMovementType.WASTE, 250.0, null, "انسكب", null, null));

        assertEquals(750.0, beans.getStockQuantity());

        RawMaterialMovement m = saved();
        assertEquals(-250.0, m.getQuantityChange(), "the sign belongs to the type, not the typist");
        assertEquals(new BigDecimal("50.00"), m.getTotalCost(), "250 × 0.20");
    }

    @Test
    void aMovementCannotDriveStockNegative() {
        ResponseStatusException ex = assertThrows(ResponseStatusException.class,
                () -> service.record(new RawMaterialMovementRequest(
                        1L, RawMaterialMovementType.WASTE, 5000.0, null, null, null, null)));

        assertEquals(HttpStatus.CONFLICT, ex.getStatusCode());
        assertEquals(1000.0, beans.getStockQuantity());
        verify(movementRepository, never()).save(any());
    }

    // ── corrections ───────────────────────────────────────────────────────────

    @Test
    void aCorrectionStatesTheCountedTotalNotADelta() {
        service.record(new RawMaterialMovementRequest(
                1L, RawMaterialMovementType.CORRECTION, 900.0, null, "عد يدوي", null, null));

        assertEquals(900.0, beans.getStockQuantity());
        assertEquals(-100.0, saved().getQuantityChange(), "the row carries what changed");
    }

    // ── stocktake ─────────────────────────────────────────────────────────────

    @Test
    void aStocktakeCountThatDisagreesLeavesARow() {
        service.recordAuditCount(beans, 940.0, RawMaterialMovementType.AUDIT_CLOSING, 7L, "جرد نهاية الوردية");

        assertEquals(940.0, beans.getStockQuantity());
        RawMaterialMovement m = saved();
        assertEquals(-60.0, m.getQuantityChange());
        assertEquals(7L, m.getShiftId());
        assertEquals(new BigDecimal("12.00"), m.getTotalCost(), "60 g of unexplained loss at 0.20");
    }

    @Test
    void aCountThatAgreesWithTheBooksIsNotAMovement() {
        service.recordAuditCount(beans, 1000.0, RawMaterialMovementType.AUDIT_OPENING, 7L, null);

        verify(movementRepository, never()).save(any());
        assertEquals(1000.0, beans.getStockQuantity());
    }

    @Test
    void stocktakeTypesCannotBeRecordedByHand() {
        // Otherwise an operator could forge a shift variance from the restock screen.
        assertThrows(ResponseStatusException.class, () -> service.record(new RawMaterialMovementRequest(
                1L, RawMaterialMovementType.AUDIT_CLOSING, 10.0, null, null, null, null)));
    }

    // ── input guards ──────────────────────────────────────────────────────────

    @Test
    void aZeroOrNegativeQuantityIsRefused() {
        assertThrows(ResponseStatusException.class, () -> service.record(new RawMaterialMovementRequest(
                1L, RawMaterialMovementType.RESTOCK, 0.0, null, null, null, null)));
        assertThrows(ResponseStatusException.class, () -> service.record(new RawMaterialMovementRequest(
                1L, RawMaterialMovementType.RESTOCK, -5.0, null, null, null, null)));
    }

    @Test
    void anUnknownMaterialIsANotFound() {
        when(auditItemRepository.findById(404L)).thenReturn(Optional.empty());

        ResponseStatusException ex = assertThrows(ResponseStatusException.class,
                () -> service.record(new RawMaterialMovementRequest(
                        404L, RawMaterialMovementType.RESTOCK, 10.0, null, null, null, null)));

        assertEquals(HttpStatus.NOT_FOUND, ex.getStatusCode());
    }
}
