package com.example.cafemangmentsystem.license;

import com.example.cafemangmentsystem.billing.BillingService;
import com.example.cafemangmentsystem.billing.SubscriptionService;
import com.example.cafemangmentsystem.billing.entity.LicenseKeyActivation;
import com.example.cafemangmentsystem.billing.entity.PaymentMethod;
import com.example.cafemangmentsystem.billing.entity.Plan;
import com.example.cafemangmentsystem.billing.entity.TenantSubscription;
import com.example.cafemangmentsystem.billing.repository.LicenseKeyActivationRepository;
import com.example.cafemangmentsystem.billing.repository.PlanRepository;
import com.example.cafemangmentsystem.common.tenant.CurrentActor;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.security.SecureRandom;
import java.time.Duration;
import java.time.Instant;
import java.util.List;

/**
 * Generation and redemption of offline licence keys.
 *
 * <p>Redemption is the part that was genuinely unsafe before: it read the key, checked whether it
 * was usable, then incremented a counter — a textbook check-then-act race in which two concurrent
 * requests both saw {@code activationsCount = 0} and both redeemed a single-use key. It now takes a
 * row lock on the key, decides on the {@code license_key_activations} rows, and relies on a unique
 * constraint as a second line of defence.
 */
@Service
@RequiredArgsConstructor
@Transactional
public class LicenseKeyService {

    private static final SecureRandom RNG = new SecureRandom();
    private static final String CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no I/O/1/0

    private final LicenseKeyRepository repository;
    private final LicenseKeyActivationRepository activationRepository;
    private final PlanRepository planRepository;
    private final SubscriptionService subscriptionService;
    private final BillingService billingService;

    // ── Generation ──────────────────────────────────────────────────────────

    public LicenseKey generate(String planCode, int durationDays, Integer redeemableForDays,
                               Integer maxActivations, BigDecimal price, String notes) {
        Plan plan = planRepository.findByCode(planCode)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Unknown plan: " + planCode));
        if (durationDays < 0 || durationDays > 3650) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "durationDays must be between 0 and 3650");
        }
        if (redeemableForDays != null && (redeemableForDays < 1 || redeemableForDays > 3650)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "redeemableForDays must be between 1 and 3650");
        }
        int activations = maxActivations != null ? maxActivations : 1;
        if (activations < 1 || activations > 1000) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "maxActivations must be between 1 and 1000");
        }

        LicenseKey key = new LicenseKey();
        key.setKey(allocateKey());
        key.setPlan(plan);
        key.setDurationDays(durationDays);
        key.setRedeemableUntil(redeemableForDays != null
                ? Instant.now().plus(Duration.ofDays(redeemableForDays)) : null);
        key.setMaxActivations(activations);
        key.setPrice(price != null ? price : plan.getPrice());
        key.setCurrency(plan.getCurrency());
        key.setNotes(notes);
        return repository.save(key);
    }

    private String allocateKey() {
        for (int attempt = 0; attempt < 20; attempt++) {
            String candidate = "CAFF-" + block() + "-" + block() + "-" + block();
            if (!repository.existsByKey(candidate)) return candidate;
        }
        throw new IllegalStateException("Could not allocate a unique licence key");
    }

    private String block() {
        StringBuilder sb = new StringBuilder(4);
        for (int i = 0; i < 4; i++) sb.append(CHARS.charAt(RNG.nextInt(CHARS.length())));
        return sb.toString();
    }

    // ── Reads ───────────────────────────────────────────────────────────────

    @Transactional(readOnly = true)
    public List<LicenseKey> listAll() {
        return repository.findAllByOrderByCreatedAtDesc();
    }

    @Transactional(readOnly = true)
    public LicenseKeyValidationResult validate(String rawKey) {
        return repository.findByKey(normalise(rawKey))
                .map(key -> {
                    if (key.isRevoked()) return LicenseKeyValidationResult.invalid("LICENSE_REVOKED");
                    if (key.isRedemptionWindowClosed()) return LicenseKeyValidationResult.invalid("LICENSE_EXPIRED");
                    long used = activationRepository.countByLicenseKeyId(key.getId());
                    if (used >= key.getMaxActivations()) {
                        return LicenseKeyValidationResult.invalid("LICENSE_ALREADY_USED");
                    }
                    return LicenseKeyValidationResult.valid(key, (int) used);
                })
                .orElse(LicenseKeyValidationResult.invalid("LICENSE_NOT_FOUND"));
    }

    // ── Redemption ──────────────────────────────────────────────────────────

    /**
     * Redeems a key for a tenant: records the activation, opens the subscription period the key
     * pays for, and raises a settled invoice so the sale shows up in revenue.
     */
    public TenantSubscription redeem(String rawKey, Long tenantId) {
        if (tenantId == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "No tenant in context");
        }
        String normalised = normalise(rawKey);

        LicenseKey key = repository.findByKeyForUpdate(normalised)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND,
                        "مفتاح الترخيص غير موجود، يرجى التأكد من الكود"));

        if (key.isRevoked()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "تم إلغاء هذا المفتاح من قبل الإدارة");
        }
        if (key.isRedemptionWindowClosed()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "انتهت صلاحية استخدام هذا المفتاح");
        }
        if (activationRepository.existsByLicenseKeyIdAndTenantId(key.getId(), tenantId)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "تم استخدام هذا المفتاح لهذا الحساب مسبقاً");
        }
        long used = activationRepository.countByLicenseKeyId(key.getId());
        if (used >= key.getMaxActivations()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "تم استخدام هذا المفتاح بالكامل");
        }

        LicenseKeyActivation activation = new LicenseKeyActivation();
        activation.setLicenseKeyId(key.getId());
        activation.setTenantId(tenantId);
        activation.setActivatedAt(Instant.now());
        activation.setActivatedBy(CurrentActor.name());
        try {
            activationRepository.saveAndFlush(activation);
        } catch (DataIntegrityViolationException duplicate) {
            // Lost a race despite the lock (separate nodes, no shared lock manager on SQLite).
            throw new ResponseStatusException(HttpStatus.CONFLICT, "تم استخدام هذا المفتاح مسبقاً");
        }

        key.setActivationsCount((int) used + 1);
        repository.save(key);

        TenantSubscription subscription = subscriptionService.activateFromLicense(
                tenantId, key.getPlan(), key.getDurationDays(), key.getPrice(), key.getId(), key.getKey());

        activation.setSubscriptionId(subscription.getId());
        activationRepository.save(activation);

        billingService.issueSettled(subscription, subscription.getCurrentPeriodStart(),
                subscription.getCurrentPeriodEnd(), key.getPrice(), PaymentMethod.LICENSE_KEY,
                key.getKey(), CurrentActor.name());

        return subscription;
    }

    public LicenseKey revoke(Long id, String reason) {
        LicenseKey key = repository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "License key not found"));
        key.setRevoked(true);
        key.setRevokedAt(Instant.now());
        key.setRevokeReason(reason);
        return repository.save(key);
    }

    private String normalise(String rawKey) {
        if (rawKey == null || rawKey.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "License key is required");
        }
        return rawKey.trim().toUpperCase(java.util.Locale.ROOT);
    }
}
