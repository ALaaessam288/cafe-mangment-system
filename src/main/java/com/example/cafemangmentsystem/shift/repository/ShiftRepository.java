package com.example.cafemangmentsystem.shift.repository;

import com.example.cafemangmentsystem.shift.entity.Shift;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface ShiftRepository extends JpaRepository<Shift, Long> {

    boolean existsByUserIdAndClosedAtIsNull(Long userId);

    boolean existsByTenantIdAndRegisterIdAndClosedAtIsNull(Long tenantId, Long registerId);

    boolean existsByRegisterIdAndClosedAtIsNull(Long registerId);

    boolean existsByClosedAtIsNull();

    Optional<Shift> findByUserIdAndClosedAtIsNull(Long userId);

    List<Shift> findAllByClosedAtIsNull();

    List<Shift> findAllByUserId(Long userId);

    List<Shift> findAllByUserIdAndClosedAtIsNull(Long userId);
}