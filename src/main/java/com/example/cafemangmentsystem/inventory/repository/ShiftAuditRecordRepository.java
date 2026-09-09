package com.example.cafemangmentsystem.inventory.repository;

import com.example.cafemangmentsystem.inventory.entity.ShiftAuditRecord;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.List;

@Repository
public interface ShiftAuditRecordRepository extends JpaRepository<ShiftAuditRecord, Long> {
    List<ShiftAuditRecord> findAllByShiftId(Long shiftId);

    /**
     * The cost of the raw materials actually consumed by sales in a window.
     *
     * <p>This is cost of goods sold in the accrual sense — what was used, not what was bought.
     * Purchases are cash leaving; a sack of beans is not a cost until it goes through the grinder.
     * The consumption figure per material per shift is already reconciled at the shift boundary,
     * so it is valued here against each material's standing cost.
     *
     * <p>Both bounds are required. The {@code :param IS NULL OR ...} spelling binds an untyped null
     * that PostgreSQL refuses outright ("could not determine data type of parameter"), which is a
     * bug this codebase has already been bitten by — callers widen the window instead.
     */
    @Query("""
            SELECT COALESCE(SUM(r.soldDeductionCount * i.costPerUnit), 0)
            FROM ShiftAuditRecord r
            JOIN r.auditItem i
            JOIN r.shift s
            WHERE i.costPerUnit > 0
              AND COALESCE(s.closedAt, s.openedAt) >= :from
              AND COALESCE(s.closedAt, s.openedAt) <= :to
            """)
    Double sumConsumedCost(@Param("from") Instant from, @Param("to") Instant to);
}
