package com.example.cafemangmentsystem.discount.repository;

import com.example.cafemangmentsystem.discount.entity.Discount;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface DiscountRepository extends JpaRepository<Discount, Long> {

    List<Discount> findAllByOrderId(Long orderId);
}