package com.example.cafemangmentsystem.shift.event;

import java.math.BigDecimal;
import java.time.Instant;

/**
 * What happened to a shift, for anything that wants to react to it without ShiftService knowing.
 *
 * <p>These carry the numbers rather than ids so a listener never re-queries — the figures in the
 * message are then provably the same ones that were written, not a second read that could disagree
 * with them.
 *
 * <p>The tenant id travels in the event on purpose. Listeners run after commit, and relying on the
 * request's {@code TenantContext} ThreadLocal still being populated at that point is an assumption
 * about filter ordering that nothing enforces.
 */
public final class ShiftEvents {

    private ShiftEvents() {}

    public record ShiftOpened(
            Long tenantId,
            Long shiftId,
            String cashierName,
            String registerName,
            BigDecimal openingFloat,
            Instant openedAt
    ) {}

    public record ShiftClosed(
            Long tenantId,
            Long shiftId,
            String cashierName,
            String registerName,
            Instant openedAt,
            Instant closedAt,
            BigDecimal openingFloat,
            BigDecimal cashSales,
            BigDecimal expectedCash,
            BigDecimal countedCash,
            BigDecimal variance
    ) {}
}
