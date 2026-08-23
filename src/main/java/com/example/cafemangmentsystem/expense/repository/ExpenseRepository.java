package com.example.cafemangmentsystem.expense.repository;

import com.example.cafemangmentsystem.expense.entity.Expense;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.math.BigDecimal;

public interface ExpenseRepository extends JpaRepository<Expense, Long> {

    @Query("SELECT COALESCE(SUM(e.amount), 0) FROM Expense e WHERE e.shift.id = :shiftId AND e.paidFromDrawer = true")
    BigDecimal sumDrawerAmountByShiftId(@Param("shiftId") Long shiftId);

    @Query("SELECT COALESCE(SUM(e.amount), 0) FROM Expense e WHERE e.shift.id = :shiftId")
    BigDecimal sumTotalByShiftId(@Param("shiftId") Long shiftId);

    java.util.List<Expense> findAllByShiftId(Long shiftId);
}