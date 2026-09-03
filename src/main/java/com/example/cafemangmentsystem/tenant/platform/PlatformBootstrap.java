package com.example.cafemangmentsystem.tenant.platform;

import com.example.cafemangmentsystem.common.tenant.TenantContext;
import com.example.cafemangmentsystem.tenant.entity.BusinessType;
import com.example.cafemangmentsystem.tenant.entity.Tenant;
import com.example.cafemangmentsystem.tenant.entity.TenantStatus;
import com.example.cafemangmentsystem.tenant.repository.TenantRepository;
import com.example.cafemangmentsystem.user.entity.User;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

import java.util.Locale;
import java.util.Set;

/**
 * Creates the platform tenant and its first SUPER_ADMIN, from environment variables only.
 *
 * <p>This replaces a block in {@code DatabaseSeeder} that hardcoded a real username and the
 * password {@code alaa@12345} into the source, and therefore into every build artefact and every
 * copy of the installer. Anyone who read the repository — or unzipped the desktop app — held the
 * platform owner's credentials for every deployment that had ever run that seeder.
 *
 * <p>Three rules make this safe to leave enabled:
 * <ul>
 *   <li>Credentials come from {@code APP_PLATFORM_ADMIN_USERNAME} / {@code _PASSWORD}. There is no
 *       default. Unset means no account is created, and the log says so.</li>
 *   <li>It runs only when no SUPER_ADMIN exists yet. It never resets an existing one — recovery is
 *       a deliberate operation, not a side effect of a restart.</li>
 *   <li>A weak or obviously placeholder password is refused outright rather than accepted with a
 *       warning nobody reads.</li>
 * </ul>
 */
@Component
@RequiredArgsConstructor
@Order(10)
@Slf4j
public class PlatformBootstrap implements ApplicationRunner {

    private static final int MIN_PASSWORD_LENGTH = 12;

    /** Passwords that have appeared in this codebase, its docs, or every breach list ever compiled. */
    private static final Set<String> FORBIDDEN = Set.of(
            "alaa@12345", "admin", "password", "12345678", "123456789", "changeme",
            "caffio", "caffio123", "superadmin", "P@ssw0rd", "admin@123");

    private final TenantRepository tenantRepository;
    private final PlatformAdminSaver adminSaver;

    @Value("${app.platform.admin-username:}")
    private String username;

    @Value("${app.platform.admin-password:}")
    private String password;

    @Value("${app.platform.admin-full-name:Platform Owner}")
    private String fullName;

    /*
     * Deliberately NOT @Transactional. Hibernate fixes a session's tenant id when the session
     * opens, so the context has to be set before any transaction starts — hence the delegation to
     * PlatformAdminSaver, whose REQUIRES_NEW methods each open a session that can see it.
     */
    @Override
    public void run(ApplicationArguments args) {
        Tenant platform = tenantRepository.findBySlug("platform").orElse(null);
        if (platform == null) {
            platform = createPlatformTenant();
        }

        TenantContext.set(platform.getId());
        boolean exists;
        try {
            exists = adminSaver.superAdminExists();
        } finally {
            TenantContext.clear();
        }
        if (exists) {
            log.debug("[PLATFORM] A super admin already exists; bootstrap skipped.");
            return;
        }

        if (isBlank(username) || isBlank(password)) {
            log.warn("[PLATFORM] No super admin exists and APP_PLATFORM_ADMIN_USERNAME/PASSWORD are "
                    + "not set, so none was created. Set both and restart, or call "
                    + "POST /api/platform/super-admin with the provisioning key.");
            return;
        }

        String rejection = reject(password);
        if (rejection != null) {
            log.error("[PLATFORM] Refusing to create the super admin: {}. No account was created.", rejection);
            return;
        }

        TenantContext.set(platform.getId());
        try {
            User admin = adminSaver.createSuperAdmin(
                    username.trim(),
                    isBlank(fullName) ? "Platform Owner" : fullName.trim(),
                    password);
            // The username is safe to log; the password never is.
            log.info("[PLATFORM] Created the initial super admin '{}' for tenant {}.",
                    admin.getUsername(), admin.getTenantId());
        } finally {
            TenantContext.clear();
        }
    }

    private Tenant createPlatformTenant() {
        Tenant platform = new Tenant();
        platform.setName("Caffio Platform");
        platform.setSlug("platform");
        platform.setBusinessType(BusinessType.CAFE_AND_RESTAURANT);
        platform.setStatus(TenantStatus.ACTIVE);
        platform.setTimezone("Africa/Cairo");
        platform.setCurrency("EGP");
        platform.setPlanSelected(true);
        Tenant saved = tenantRepository.save(platform);
        log.info("[PLATFORM] Created the platform tenant (id {}).", saved.getId());
        return saved;
    }

    /** @return why the password is unacceptable, or null if it is fine. */
    private String reject(String candidate) {
        String trimmed = candidate.trim();
        if (trimmed.length() < MIN_PASSWORD_LENGTH) {
            return "the password is shorter than " + MIN_PASSWORD_LENGTH + " characters";
        }
        if (FORBIDDEN.contains(trimmed.toLowerCase(Locale.ROOT)) || FORBIDDEN.contains(trimmed)) {
            return "the password is a known default or placeholder";
        }
        boolean hasLetter = trimmed.chars().anyMatch(Character::isLetter);
        boolean hasDigit = trimmed.chars().anyMatch(Character::isDigit);
        if (!hasLetter || !hasDigit) {
            return "the password needs at least one letter and one digit";
        }
        return null;
    }

    private boolean isBlank(String value) {
        return value == null || value.isBlank();
    }
}
