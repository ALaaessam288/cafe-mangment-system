package com.example.cafemangmentsystem.inventory.dto;

import com.example.cafemangmentsystem.inventory.entity.RawMaterialMovementType;
import jakarta.validation.constraints.NotNull;

import java.math.BigDecimal;

/**
 * A stock movement the operator is recording by hand.
 *
 * <p>{@code quantity} is always stated as a positive amount — the sign belongs to the type, not to
 * the person typing. Asking a cashier to enter "-250" to record spillage is how a restock ends up
 * booked as waste.
 */
public record RawMaterialMovementRequest(
        @NotNull(message = "الخامة مطلوبة")
        Long auditItemId,

        @NotNull(message = "نوع الحركة مطلوب")
        RawMaterialMovementType type,

        @NotNull(message = "الكمية مطلوبة")
        Double quantity,

        /** Cost of one unit on a purchase. Ignored for anything that is not a RESTOCK. */
        BigDecimal unitCost,

        String reason,
        String reference,
        Long shiftId
) {
}
