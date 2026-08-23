package com.example.cafemangmentsystem.tenant;

import com.example.cafemangmentsystem.common.tenant.TenantContext;
import com.example.cafemangmentsystem.tenant.dto.TenantResponse;
import com.example.cafemangmentsystem.tenant.entity.Tenant;
import com.example.cafemangmentsystem.tenant.entity.TenantStatus;
import com.example.cafemangmentsystem.tenant.dto.PublicTenantDto;
import com.example.cafemangmentsystem.tenant.platform.TenantOwnerProvisioner;
import com.example.cafemangmentsystem.tenant.platform.TenantSaver;
import com.example.cafemangmentsystem.tenant.platform.dto.ProvisionTenantRequest;
import com.example.cafemangmentsystem.tenant.platform.dto.ProvisionTenantResponse;
import com.example.cafemangmentsystem.tenant.repository.TenantRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Transactional
public class TenantService {

    private static final Set<TenantStatus> LOGINABLE = Set.of(TenantStatus.TRIAL, TenantStatus.ACTIVE);

    private final TenantRepository tenantRepository;
    private final TenantOwnerProvisioner tenantOwnerProvisioner;
    private final TenantSaver tenantSaver;
    private final com.example.cafemangmentsystem.security.jwt.JwtService jwtService;
    private final com.example.cafemangmentsystem.menu.MenuTemplateService menuTemplateService;
    private final com.example.cafemangmentsystem.tenant.repository.TenantActivityLogRepository tenantActivityLogRepository;

    /**
     * Resolves a tenant for login. Deliberately throws the same {@link BadCredentialsException}
     * for "no such slug" and "tenant not loginable" as a wrong password would - AuthController's
     * existing handler turns that into a generic 401, so we never reveal whether it was the
     * tenant, the username, or the password that was wrong.
     */
    @Transactional(readOnly = true)
    public Tenant resolveLoginableTenant(String slug) {
        Tenant tenant = tenantRepository.findBySlug(slug)
                .orElseThrow(() -> new BadCredentialsException("Unknown tenant"));
        if (!LOGINABLE.contains(tenant.getStatus())) {
            throw new BadCredentialsException("Tenant is not active");
        }
        return tenant;
    }

    @Transactional(readOnly = true)
    public TenantResponse findById(Long id) {
        return tenantRepository.findById(id)
                .map(TenantResponse::from)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Tenant not found: " + id));
    }

    @Transactional(readOnly = true)
    public List<PublicTenantDto> findAllPublic() {
        return tenantRepository.findAll().stream()
                .filter(t -> LOGINABLE.contains(t.getStatus()))
                .map(t -> new PublicTenantDto(t.getSlug(), t.getName(), t.getBusinessType().name()))
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public List<TenantResponse> findAllTenants() {
        return tenantRepository.findAll().stream()
                .map(TenantResponse::from)
                .collect(Collectors.toList());
    }

    public TenantResponse updateTenantSubscription(Long tenantId, com.example.cafemangmentsystem.tenant.entity.SubscriptionPlan plan, TenantStatus status, Integer extendDays) {
        Tenant tenant = tenantRepository.findById(tenantId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Tenant not found: " + tenantId));
        
        String action = "UPDATED";
        String details = "Updated";
        
        if (plan != null) {
            tenant.setSubscriptionPlan(plan);
            if (plan == com.example.cafemangmentsystem.tenant.entity.SubscriptionPlan.PRO) {
                tenant.setMaxTables(Integer.MAX_VALUE);
                tenant.setMaxUsers(Integer.MAX_VALUE);
                tenant.setMaxProducts(Integer.MAX_VALUE);
            } else if (plan == com.example.cafemangmentsystem.tenant.entity.SubscriptionPlan.STARTER) {
                tenant.setMaxTables(20);
                tenant.setMaxUsers(5);
                tenant.setMaxProducts(100);
            }
            action = "PLAN_UPGRADED";
            details = "Plan changed to " + plan;
        }
        if (status != null) {
            tenant.setStatus(status);
            if (status == TenantStatus.SUSPENDED) {
                action = "SUSPENDED";
                details = "Tenant suspended";
            }
        }
        if (extendDays != null && extendDays > 0) {
            java.time.Instant current = tenant.getTrialEndsAt() != null ? tenant.getTrialEndsAt() : java.time.Instant.now();
            tenant.setTrialEndsAt(current.plus(extendDays, java.time.temporal.ChronoUnit.DAYS));
            action = "TRIAL_EXTENDED";
            details = "Trial extended by " + extendDays + " days";
        }

        Tenant saved = tenantRepository.save(tenant);
        
        tenantActivityLogRepository.save(com.example.cafemangmentsystem.tenant.entity.TenantActivityLog.builder()
                .tenantId(saved.getId())
                .action(action)
                .details(details)
                .performedBy("SYSTEM_OR_ADMIN")
                .build());
                
        return TenantResponse.from(saved);
    }

    /**
     * Provisions a new tenant + its owner user.
     *
     * SQLite is single-writer: two concurrent transactions cause SQLITE_BUSY.
     * We must NOT hold an outer transaction while calling sub-transactions, so
     * this method runs with NOT_SUPPORTED (suspends any ambient transaction).
     *
     * Sequence (each step commits fully before the next opens a connection):
     *   1. TenantSaver.existsBySlug()  — REQUIRES_NEW → commits → releases lock
     *   2. TenantSaver.save()          — REQUIRES_NEW → commits → releases lock
     *   3. TenantContext.set(tenantId) — no DB work
     *   4. TenantOwnerProvisioner      — REQUIRES_NEW → commits → releases lock
     */
    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    public ProvisionTenantResponse provisionWithSetup(ProvisionTenantRequest request) {
        if (tenantSaver.existsBySlug(request.slug())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Slug already taken: " + request.slug());
        }

        Tenant tenant = Tenant.builder()
                .name(request.name())
                .slug(request.slug())
                .businessType(request.businessType())
                .status(TenantStatus.TRIAL)
                .subscriptionPlan(com.example.cafemangmentsystem.tenant.entity.SubscriptionPlan.TRIAL)
                .trialEndsAt(java.time.Instant.now().plus(14, java.time.temporal.ChronoUnit.DAYS))
                .timezone(request.timezone() == null ? "UTC" : request.timezone())
                .currency(request.currency() == null ? "EGP" : request.currency())
                .build();

        tenant = tenantSaver.save(tenant);
        
        // Log CREATED event
        tenantActivityLogRepository.save(com.example.cafemangmentsystem.tenant.entity.TenantActivityLog.builder()
                .tenantId(tenant.getId())
                .action("CREATED")
                .details("Tenant provisioned")
                .performedBy(request.ownerUsername())
                .build());
        
        com.example.cafemangmentsystem.user.entity.User owner;
        TenantContext.set(tenant.getId());
        try {
            owner = tenantOwnerProvisioner.createOwner(
                    request.ownerUsername(), request.ownerFullName(), request.ownerPassword(), request.defaultTables());
            
            if (request.templateId() != null && !request.templateId().isBlank()) {
                menuTemplateService.seedTemplate(request.templateId());
            }
        } finally {
            TenantContext.clear();
        }

        String jwtToken = jwtService.generateToken(new com.example.cafemangmentsystem.security.UserPrincipal(owner));
        return new ProvisionTenantResponse(tenant.getId(), tenant.getSlug(), request.ownerUsername(), jwtToken);
    }
    
    @Transactional(readOnly = true)
    public java.util.Map<String, Object> getPlatformStats() {
        long totalTenants = tenantRepository.count();
        long activeTenants = tenantRepository.findAll().stream().filter(t -> t.getStatus() == TenantStatus.ACTIVE).count();
        long trialTenants = tenantRepository.findAll().stream().filter(t -> t.getStatus() == TenantStatus.TRIAL).count();
        return java.util.Map.of(
            "totalTenants", totalTenants,
            "activeTenants", activeTenants,
            "trialTenants", trialTenants
        );
    }
    
    @Transactional(readOnly = true)
    public java.util.Map<String, Object> getTenantUsage(Long tenantId) {
        Tenant tenant = tenantRepository.findById(tenantId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Tenant not found"));
        // For a full implementation, we'd query counts from tables using a specific repository method
        // that takes tenantId. However, we can just return the max quotas for now or dummy usage.
        return java.util.Map.of(
            "maxTables", tenant.getMaxTables() != null ? tenant.getMaxTables() : -1,
            "maxUsers", tenant.getMaxUsers() != null ? tenant.getMaxUsers() : -1,
            "maxProducts", tenant.getMaxProducts() != null ? tenant.getMaxProducts() : -1
        );
    }
    
    public TenantResponse updateQuotas(Long tenantId, Integer maxTables, Integer maxUsers, Integer maxProducts) {
        Tenant tenant = tenantRepository.findById(tenantId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Tenant not found"));
        if (maxTables != null) tenant.setMaxTables(maxTables);
        if (maxUsers != null) tenant.setMaxUsers(maxUsers);
        if (maxProducts != null) tenant.setMaxProducts(maxProducts);
        return TenantResponse.from(tenantRepository.save(tenant));
    }

    @Transactional(readOnly = true)
    public List<com.example.cafemangmentsystem.tenant.entity.TenantActivityLog> getTenantActivityLogs(Long tenantId) {
        return tenantActivityLogRepository.findByTenantIdOrderByCreatedAtDesc(tenantId);
    }
}








