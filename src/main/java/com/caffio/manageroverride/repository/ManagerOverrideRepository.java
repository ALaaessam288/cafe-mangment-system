package com.caffio.manageroverride.repository;

import com.caffio.manageroverride.entity.ManagerOverride;
import com.caffio.manageroverride.entity.ManagerOverrideType;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface ManagerOverrideRepository extends JpaRepository<ManagerOverride, Long> {

    List<ManagerOverride> findAllByOrderByPerformedAtDesc();

    List<ManagerOverride> findAllByShiftIdOrderByPerformedAtDesc(Long shiftId);

    List<ManagerOverride> findAllByOrderIdOrderByPerformedAtDesc(Long orderId);

    List<ManagerOverride> findAllByActionTypeOrderByPerformedAtDesc(ManagerOverrideType actionType);
}
