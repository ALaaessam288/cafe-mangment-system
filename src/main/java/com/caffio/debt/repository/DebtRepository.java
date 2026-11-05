package com.caffio.debt.repository;

import com.caffio.debt.entity.Debt;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface DebtRepository extends JpaRepository<Debt, Long> {
    List<Debt> findAllByOrderByDebtDateDesc();

    List<Debt> findBySettledFalse();
}