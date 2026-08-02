package com.example.cafemangmentsystem.menu.repository;

import com.example.cafemangmentsystem.menu.entity.ProductOption;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface ProductOptionRepository extends JpaRepository<ProductOption, Long> {

    List<ProductOption> findAllByProductId(Long productId);
}