package com.example.cafemangmentsystem.debt.repository;

import com.example.cafemangmentsystem.debt.entity.Debt;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface DebtRepository extends JpaRepository<Debt, Long> {
    List<Debt> findAllByOrderByDebtDateDesc();

    List<Debt> findBySettledFalse();
}