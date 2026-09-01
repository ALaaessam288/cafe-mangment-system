package com.example.cafemangmentsystem.manageroverride.repository;

import com.example.cafemangmentsystem.manageroverride.entity.ManagerOverride;
import com.example.cafemangmentsystem.manageroverride.entity.ManagerOverrideType;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface ManagerOverrideRepository extends JpaRepository<ManagerOverride, Long> {

    List<ManagerOverride> findAllByOrderByPerformedAtDesc();

    List<ManagerOverride> findAllByShiftIdOrderByPerformedAtDesc(Long shiftId);

    List<ManagerOverride> findAllByOrderIdOrderByPerformedAtDesc(Long orderId);

    List<ManagerOverride> findAllByActionTypeOrderByPerformedAtDesc(ManagerOverrideType actionType);
}
