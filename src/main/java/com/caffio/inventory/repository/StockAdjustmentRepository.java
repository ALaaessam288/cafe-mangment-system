package com.caffio.inventory.repository;

import com.caffio.inventory.entity.StockAdjustment;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface StockAdjustmentRepository extends JpaRepository<StockAdjustment, Long> {

    /** Stock movements also pin a product down: the FK has no cascade, by design. */
    boolean existsByProductId(Long productId);

    List<StockAdjustment> findAllByProductIdOrderByAdjustedAtDesc(Long productId);
}