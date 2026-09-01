package com.example.cafemangmentsystem.cashmovement.repository;

import com.example.cafemangmentsystem.cashmovement.entity.CashMovement;
import com.example.cafemangmentsystem.cashmovement.entity.CashMovementType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.math.BigDecimal;
import java.util.List;

public interface CashMovementRepository extends JpaRepository<CashMovement, Long> {

    List<CashMovement> findAllByShiftIdOrderByPerformedAtDesc(Long shiftId);

    @Query("SELECT COALESCE(SUM(c.amount), 0) FROM CashMovement c WHERE c.shift.id = :shiftId AND c.type = :type")
    BigDecimal sumAmountByShiftIdAndType(@Param("shiftId") Long shiftId, @Param("type") CashMovementType type);

    @Query("SELECT COALESCE(SUM(c.amount), 0) FROM CashMovement c WHERE c.shift.id = :shiftId AND c.type IN :types")
    BigDecimal sumAmountByShiftIdAndTypes(@Param("shiftId") Long shiftId, @Param("types") List<CashMovementType> types);
}
