package com.example.cafemangmentsystem.billing.repository;

import com.example.cafemangmentsystem.billing.entity.LicenseKeyActivation;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface LicenseKeyActivationRepository extends JpaRepository<LicenseKeyActivation, Long> {

    long countByLicenseKeyId(Long licenseKeyId);

    boolean existsByLicenseKeyIdAndTenantId(Long licenseKeyId, Long tenantId);

    List<LicenseKeyActivation> findByLicenseKeyIdOrderByActivatedAtAsc(Long licenseKeyId);
}
