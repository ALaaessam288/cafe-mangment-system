package com.example.cafemangmentsystem.license;

import com.example.cafemangmentsystem.tenant.entity.SubscriptionPlan;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface LicenseKeyRepository extends JpaRepository<LicenseKey, Long> {
    Optional<LicenseKey> findByKey(String key);
    List<LicenseKey> findByPlan(SubscriptionPlan plan);
    List<LicenseKey> findAllByOrderByCreatedAtDesc();
    boolean existsByKey(String key);
}
