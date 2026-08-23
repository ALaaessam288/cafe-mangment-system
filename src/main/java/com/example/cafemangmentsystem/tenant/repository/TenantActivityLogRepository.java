package com.example.cafemangmentsystem.tenant.repository;

import com.example.cafemangmentsystem.tenant.entity.TenantActivityLog;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface TenantActivityLogRepository extends JpaRepository<TenantActivityLog, Long> {
    List<TenantActivityLog> findByTenantIdOrderByCreatedAtDesc(Long tenantId);
}
