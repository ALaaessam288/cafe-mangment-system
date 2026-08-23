package com.example.cafemangmentsystem.discount.repository;

import com.example.cafemangmentsystem.discount.entity.Discount;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface DiscountRepository extends JpaRepository<Discount, Long> {

    List<Discount> findAllByOrderId(Long orderId);

    /**
     * Item-scoped discounts attached to a single line. Needed when a line is deleted outright
     * (see {@code OrderService.removeUnsentItem}) - the discount rows point at it via a foreign
     * key and have to go first.
     */
    List<Discount> findAllByItemId(Long itemId);
}