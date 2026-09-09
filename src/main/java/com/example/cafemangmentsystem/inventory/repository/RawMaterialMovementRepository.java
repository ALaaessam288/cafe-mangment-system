package com.example.cafemangmentsystem.inventory.repository;

import com.example.cafemangmentsystem.inventory.entity.RawMaterialMovement;
import com.example.cafemangmentsystem.inventory.entity.RawMaterialMovementType;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

@Repository
public interface RawMaterialMovementRepository extends JpaRepository<RawMaterialMovement, Long> {

    List<RawMaterialMovement> findByAuditItemIdOrderByOccurredAtDescIdDesc(Long auditItemId);

    Page<RawMaterialMovement> findAllByOrderByOccurredAtDescIdDesc(Pageable pageable);

    Page<RawMaterialMovement> findByTypeOrderByOccurredAtDescIdDesc(RawMaterialMovementType type, Pageable pageable);

    Page<RawMaterialMovement> findByOccurredAtBetweenOrderByOccurredAtDescIdDesc(
            Instant from, Instant to, Pageable pageable);

    /**
     * What was actually spent on raw materials in a period — the purchase side of cost of goods sold.
     * Until this ledger existed there was no way to answer it at all.
     */
    @Query("""
            SELECT COALESCE(SUM(m.totalCost), 0) FROM RawMaterialMovement m
            WHERE m.type = com.example.cafemangmentsystem.inventory.entity.RawMaterialMovementType.RESTOCK
              AND m.occurredAt >= :from AND m.occurredAt < :to
            """)
    BigDecimal sumPurchasesBetween(@Param("from") Instant from, @Param("to") Instant to);

    /** The money thrown away in a period, valued at the material's standing cost. */
    @Query("""
            SELECT COALESCE(SUM(m.totalCost), 0) FROM RawMaterialMovement m
            WHERE m.type = com.example.cafemangmentsystem.inventory.entity.RawMaterialMovementType.WASTE
              AND m.occurredAt >= :from AND m.occurredAt < :to
            """)
    BigDecimal sumWasteBetween(@Param("from") Instant from, @Param("to") Instant to);
}
