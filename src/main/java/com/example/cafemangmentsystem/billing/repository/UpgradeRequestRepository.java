package com.example.cafemangmentsystem.billing.repository;

import com.example.cafemangmentsystem.billing.entity.UpgradeRequest;
import com.example.cafemangmentsystem.billing.entity.UpgradeRequestStatus;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface UpgradeRequestRepository extends JpaRepository<UpgradeRequest, Long> {

    List<UpgradeRequest> findByTenantIdOrderByCreatedAtDesc(Long tenantId);

    List<UpgradeRequest> findByStatusOrderByCreatedAtAsc(UpgradeRequestStatus status);

    List<UpgradeRequest> findAllByOrderByCreatedAtDesc();

    Optional<UpgradeRequest> findFirstByTenantIdAndStatusOrderByCreatedAtDesc(
            Long tenantId, UpgradeRequestStatus status);
}
