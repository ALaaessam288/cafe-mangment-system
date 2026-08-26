package com.example.cafemangmentsystem.inventory.repository;

import com.example.cafemangmentsystem.inventory.entity.ShiftAuditItem;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ShiftAuditItemRepository extends JpaRepository<ShiftAuditItem, Long> {
    List<ShiftAuditItem> findAllByActiveTrue();
    List<ShiftAuditItem> findAllByActiveTrueAndRequiresAuditTrue();
}
