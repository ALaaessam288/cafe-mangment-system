package com.example.cafemangmentsystem.menu.repository;

import com.example.cafemangmentsystem.menu.entity.Product;
import org.springframework.data.jpa.repository.JpaRepository;

import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.Query;

import java.util.List;

public interface ProductRepository extends JpaRepository<Product, Long> {

    List<Product> findAllByCategoryId(Long categoryId);
    
    @Query("SELECT p FROM OrderItem oi JOIN oi.product p WHERE p.active = true GROUP BY p ORDER BY SUM(oi.quantity) DESC")
    List<Product> findTopSellers(Pageable pageable);
}