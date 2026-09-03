package com.example.cafemangmentsystem.billing.repository;

import com.example.cafemangmentsystem.billing.entity.Plan;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface PlanRepository extends JpaRepository<Plan, Long> {

    Optional<Plan> findByCode(String code);

    boolean existsByCode(String code);

    List<Plan> findByActiveTrueOrderBySortOrderAsc();

    List<Plan> findAllByOrderBySortOrderAsc();
}
