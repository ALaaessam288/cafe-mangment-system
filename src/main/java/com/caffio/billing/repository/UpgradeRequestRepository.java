package com.caffio.billing.repository;

import com.caffio.billing.entity.UpgradeRequest;
import com.caffio.billing.entity.UpgradeRequestStatus;
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
