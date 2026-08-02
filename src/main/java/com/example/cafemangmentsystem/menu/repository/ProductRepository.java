package com.example.cafemangmentsystem.menu.repository;

import com.example.cafemangmentsystem.menu.entity.Product;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface ProductRepository extends JpaRepository<Product, Long> {

    List<Product> findAllByCategoryId(Long categoryId);
}