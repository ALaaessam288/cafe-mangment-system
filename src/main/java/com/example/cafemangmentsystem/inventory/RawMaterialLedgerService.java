package com.example.cafemangmentsystem.inventory;

import com.example.cafemangmentsystem.common.tenant.CurrentActor;
import com.example.cafemangmentsystem.inventory.dto.RawMaterialMovementDto;
import com.example.cafemangmentsystem.inventory.dto.RawMaterialMovementRequest;
import com.example.cafemangmentsystem.inventory.entity.RawMaterialMovement;
import com.example.cafemangmentsystem.inventory.entity.RawMaterialMovementType;
import com.example.cafemangmentsystem.inventory.entity.ShiftAuditItem;
import com.example.cafemangmentsystem.inventory.repository.RawMaterialMovementRepository;
import com.example.cafemangmentsystem.inventory.repository.ShiftAuditItemRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.util.List;

/**
 * The single way a raw material's stock is allowed to change.
 *
 * <p>Before this, stock moved by overwriting {@code shift_audit_items.stock_quantity} through the
 * audit-item endpoint. A delivery, a spillage and a typo all looked identical afterwards, and what
 * a delivery cost was never captured — so cost of goods sold, and every margin derived from it,
 * rested on numbers with no provenance.
 *
 * <p>Applying the delta and writing the ledger row happen in one transaction on purpose: a stock
 * change that leaves no record is exactly the thing this class exists to prevent.
 */
@Service
@RequiredArgsConstructor
@Transactional
public class RawMaterialLedgerService {

    private final RawMaterialMovementRepository movementRepository;
    private final ShiftAuditItemRepository auditItemRepository;

    /** Records a movement entered by hand from the restock screen. */
    public RawMaterialMovementDto record(RawMaterialMovementRequest request) {
        ShiftAuditItem item = auditItemRepository.findById(request.auditItemId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND,
                        "الخامة غير موجودة: " + request.auditItemId()));

        Double quantity = request.quantity();
        if (quantity == null || !Double.isFinite(quantity) || quantity <= 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "الكمية يجب أن تكون رقماً أكبر من صفر");
        }
        if (quantity > ShiftAuditService.MAX_AUDIT_QUANTITY) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "الكمية أكبر من الحد المسموح به");
        }

        RawMaterialMovementType type = request.type();
        if (type == RawMaterialMovementType.AUDIT_OPENING || type == RawMaterialMovementType.AUDIT_CLOSING) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "حركات الجرد تُسجَّل من شاشة جرد الوردية، لا يدوياً");
        }

        // The sign is the type's business, not the operator's.
        double delta = switch (type) {
            case RESTOCK -> quantity;
            case WASTE -> -quantity;
            case CORRECTION -> quantity;
            default -> throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "نوع حركة غير مدعوم");
        };

        // A CORRECTION states the counted total, not a delta — that is what makes it a correction.
        if (type == RawMaterialMovementType.CORRECTION) {
            delta = quantity - current(item);
        }

        BigDecimal unitCost = type == RawMaterialMovementType.RESTOCK
                ? request.unitCost()
                : standingCost(item);

        if (type == RawMaterialMovementType.RESTOCK && unitCost != null
                && unitCost.compareTo(BigDecimal.ZERO) < 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "سعر الوحدة لا يمكن أن يكون سالباً");
        }

        // Buying at a new price moves the material's standing cost with it, weighted by how much of
        // the old stock is left. Overwriting it instead would value existing stock at today's price.
        if (type == RawMaterialMovementType.RESTOCK && unitCost != null) {
            item.setCostPerUnit(weightedAverageCost(item, quantity, unitCost).doubleValue());
        }

        return applyAndRecord(item, type, delta, unitCost, request.reason(), request.reference(),
                request.shiftId());
    }

    /**
     * Records a stocktake count. The audit sets the balance rather than adjusting it, so the delta
     * is whatever the count disagreed with — which is precisely the variance worth keeping.
     */
    public void recordAuditCount(ShiftAuditItem item, double countedQuantity,
                                 RawMaterialMovementType type, Long shiftId, String reason) {
        double delta = countedQuantity - current(item);
        // A count that agrees with the books is not a movement; recording it would bury the real
        // variances under a row per material per shift.
        if (Math.abs(delta) < 0.000001) return;
        applyAndRecord(item, type, delta, standingCost(item), reason, null, shiftId);
    }

    private RawMaterialMovementDto applyAndRecord(ShiftAuditItem item, RawMaterialMovementType type,
                                                  double delta, BigDecimal unitCost, String reason,
                                                  String reference, Long shiftId) {
        double resulting = current(item) + delta;
        if (resulting < 0) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "الحركة دي هتخلي رصيد «" + item.getName() + "» بالسالب (الرصيد الحالي: "
                            + current(item) + " " + item.getUnit() + ")");
        }

        item.setStockQuantity(resulting);
        auditItemRepository.save(item);

        BigDecimal totalCost = unitCost == null ? null
                : unitCost.multiply(BigDecimal.valueOf(Math.abs(delta))).setScale(2, RoundingMode.HALF_UP);

        RawMaterialMovement movement = RawMaterialMovement.builder()
                .auditItem(item)
                .type(type)
                .quantityChange(delta)
                .resultingQuantity(resulting)
                .unitCost(unitCost)
                .totalCost(totalCost)
                .reason(reason)
                .reference(reference)
                .shiftId(shiftId)
                .performedBy(CurrentActor.name())
                .occurredAt(Instant.now())
                .build();

        return RawMaterialMovementDto.from(movementRepository.save(movement));
    }

    private BigDecimal weightedAverageCost(ShiftAuditItem item, double incomingQty, BigDecimal incomingCost) {
        double existingQty = Math.max(0.0, current(item));
        BigDecimal existingCost = standingCost(item);
        if (existingCost == null || existingQty <= 0) return incomingCost;

        BigDecimal existingValue = existingCost.multiply(BigDecimal.valueOf(existingQty));
        BigDecimal incomingValue = incomingCost.multiply(BigDecimal.valueOf(incomingQty));
        BigDecimal totalQty = BigDecimal.valueOf(existingQty + incomingQty);
        if (totalQty.compareTo(BigDecimal.ZERO) <= 0) return incomingCost;

        return existingValue.add(incomingValue).divide(totalQty, 4, RoundingMode.HALF_UP);
    }

    private static double current(ShiftAuditItem item) {
        return item.getStockQuantity() == null ? 0.0 : item.getStockQuantity();
    }

    private static BigDecimal standingCost(ShiftAuditItem item) {
        Double cost = item.getCostPerUnit();
        return cost == null || cost <= 0 ? null : BigDecimal.valueOf(cost);
    }

    @Transactional(readOnly = true)
    public List<RawMaterialMovementDto> historyFor(Long auditItemId) {
        return movementRepository.findByAuditItemIdOrderByOccurredAtDescIdDesc(auditItemId).stream()
                .map(RawMaterialMovementDto::from)
                .toList();
    }

    @Transactional(readOnly = true)
    public org.springframework.data.domain.Page<RawMaterialMovementDto> ledger(
            RawMaterialMovementType type, org.springframework.data.domain.Pageable pageable) {
        var page = type == null
                ? movementRepository.findAllByOrderByOccurredAtDescIdDesc(pageable)
                : movementRepository.findByTypeOrderByOccurredAtDescIdDesc(type, pageable);
        return page.map(RawMaterialMovementDto::from);
    }
}
