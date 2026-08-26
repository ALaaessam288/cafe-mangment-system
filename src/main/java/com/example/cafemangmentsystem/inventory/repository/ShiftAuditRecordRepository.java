package com.example.cafemangmentsystem.inventory.repository;

import com.example.cafemangmentsystem.inventory.entity.ShiftAuditRecord;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ShiftAuditRecordRepository extends JpaRepository<ShiftAuditRecord, Long> {
    List<ShiftAuditRecord> findAllByShiftId(Long shiftId);
}
