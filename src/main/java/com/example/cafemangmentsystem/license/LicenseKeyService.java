package com.example.cafemangmentsystem.license;

import com.example.cafemangmentsystem.tenant.entity.SubscriptionPlan;
import com.example.cafemangmentsystem.tenant.entity.TenantActivityLog;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.security.SecureRandom;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;

@Service
@RequiredArgsConstructor
@Transactional
public class LicenseKeyService {

    private final LicenseKeyRepository repo;
    private final com.example.cafemangmentsystem.tenant.repository.TenantRepository tenantRepository;
    private final com.example.cafemangmentsystem.tenant.repository.TenantActivityLogRepository tenantActivityLogRepository;
    private static final SecureRandom RNG = new SecureRandom();
    private static final String CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no I/O/1/0

    /** Generate a key like CAFF-A1B2-C3D4-E5F6 */
    public LicenseKey generate(SubscriptionPlan plan, int validDays, String notes) {
        String key;
        do {
            key = "CAFF-" + randomBlock() + "-" + randomBlock() + "-" + randomBlock();
        } while (repo.existsByKey(key));

        Instant expires = validDays > 0 ? Instant.now().plus(validDays, ChronoUnit.DAYS) : null;

        LicenseKey lk = new LicenseKey();
        lk.setKey(key);
        lk.setPlan(plan);
        lk.setMaxActivations(1);
        lk.setExpiresAt(expires);
        lk.setNotes(notes);
        return repo.save(lk);
    }

    private String randomBlock() {
        StringBuilder sb = new StringBuilder(4);
        for (int i = 0; i < 4; i++) sb.append(CHARS.charAt(RNG.nextInt(CHARS.length())));
        return sb.toString();
    }

    @Transactional(readOnly = true)
    public List<LicenseKey> listAll() {
        return repo.findAllByOrderByCreatedAtDesc();
    }

    @Transactional(readOnly = true)
    public LicenseKeyValidationResult validate(String key) {
        return repo.findByKey(key.trim().toUpperCase())
                .map(lk -> {
                    if (lk.isRevoked())        return LicenseKeyValidationResult.invalid("LICENSE_REVOKED");
                    if (lk.isExpired())        return LicenseKeyValidationResult.invalid("LICENSE_EXPIRED");
                    if (lk.isFullyActivated()) return LicenseKeyValidationResult.invalid("LICENSE_ALREADY_USED");
                    return LicenseKeyValidationResult.valid(lk);
                })
                .orElse(LicenseKeyValidationResult.invalid("LICENSE_NOT_FOUND"));
    }

    public LicenseKey activate(String key, Long tenantId) {
        LicenseKey lk = repo.findByKey(key.trim().toUpperCase())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "License key not found"));
        if (!lk.isUsable()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "License key is not usable");
        }
        lk.setActivationsCount(lk.getActivationsCount() + 1);
        lk.setActivatedByTenantId(tenantId);
        lk.setActivatedAt(Instant.now());
        return repo.save(lk);
    }

    public com.example.cafemangmentsystem.tenant.dto.TenantResponse activateTenantLicense(Long tenantId, String key) {
        LicenseKey lk = repo.findByKey(key.trim().toUpperCase())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "مفتاح الترخيص غير موجود، يرجى التأكد من الكود"));
        if (!lk.isUsable()) {
            if (lk.isRevoked()) {
                throw new ResponseStatusException(HttpStatus.CONFLICT, "تم إلغاء هذا المفتاح من قبل الإدارة");
            }
            if (lk.isExpired()) {
                throw new ResponseStatusException(HttpStatus.CONFLICT, "انتهت صلاحية هذا المفتاح");
            }
            if (lk.isFullyActivated()) {
                throw new ResponseStatusException(HttpStatus.CONFLICT, "تم استخدام هذا المفتاح مسبقاً");
            }
            throw new ResponseStatusException(HttpStatus.CONFLICT, "مفتاح الترخيص غير صالح للاستخدام");
        }

        com.example.cafemangmentsystem.tenant.entity.Tenant tenant = tenantRepository.findById(tenantId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Tenant not found"));

        tenant.setSubscriptionPlan(lk.getPlan());
        tenant.setStatus(com.example.cafemangmentsystem.tenant.entity.TenantStatus.ACTIVE);
        tenant.setMaxTables(lk.getPlan().getMaxTables());
        tenant.setMaxUsers(lk.getPlan().getMaxUsers());
        tenant.setMaxProducts(lk.getPlan().getMaxProducts());

        if (lk.getExpiresAt() != null) {
            tenant.setSubscriptionEndsAt(lk.getExpiresAt());
        } else {
            tenant.setSubscriptionEndsAt(Instant.now().plus(3650, ChronoUnit.DAYS)); // 10 years / Lifetime
        }

        com.example.cafemangmentsystem.tenant.entity.Tenant savedTenant = tenantRepository.save(tenant);

        lk.setActivationsCount(lk.getActivationsCount() + 1);
        lk.setActivatedByTenantId(tenantId);
        lk.setActivatedAt(Instant.now());
        repo.save(lk);

        TenantActivityLog log = new TenantActivityLog();
        log.setTenantId(tenantId);
        log.setAction("LICENSE_ACTIVATED");
        log.setDetails("تم تفعيل المفتاح " + lk.getKey() + " للباقة " + lk.getPlan().getDisplayName());
        log.setPerformedBy("TENANT_ADMIN");
        tenantActivityLogRepository.save(log);

        return com.example.cafemangmentsystem.tenant.dto.TenantResponse.from(savedTenant);
    }

    public LicenseKey revoke(Long id) {
        LicenseKey lk = repo.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "License key not found"));
        lk.setRevoked(true);
        return repo.save(lk);
    }
}
