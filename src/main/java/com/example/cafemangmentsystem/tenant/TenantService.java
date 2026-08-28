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
    private final com.example.cafemangmentsystem.cafetable.repository.CafeTableRepository cafeTableRepository;
    private final com.example.cafemangmentsystem.user.repository.UserRepository userRepository;
    private final com.example.cafemangmentsystem.menu.repository.ProductRepository productRepository;
    private final com.example.cafemangmentsystem.common.whatsapp.WhatsAppService whatsAppService;

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
                .filter(t -> LOGINABLE.contains(t.getStatus()) && !"platform".equalsIgnoreCase(t.getSlug()))
                .map(t -> new PublicTenantDto(t.getSlug(), t.getName(), t.getBusinessType().name()))
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public List<TenantResponse> findAllTenants() {
        return tenantRepository.findAll().stream()
                .filter(t -> !"platform".equalsIgnoreCase(t.getSlug()))
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

    @Transactional
    public TenantResponse selectTenantPlan(Long tenantId, com.example.cafemangmentsystem.tenant.entity.SubscriptionPlan plan) {
        Tenant tenant = tenantRepository.findById(tenantId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Tenant not found: " + tenantId));

        if (plan != null) {
            tenant.setSubscriptionPlan(plan);
            if (plan == com.example.cafemangmentsystem.tenant.entity.SubscriptionPlan.ENTERPRISE) {
                tenant.setMaxTables(1000);
                tenant.setMaxUsers(1000);
                tenant.setMaxProducts(1000);
                tenant.setStatus(TenantStatus.ACTIVE);
                tenant.setSubscriptionEndsAt(java.time.Instant.now().plus(30, java.time.temporal.ChronoUnit.DAYS));
            } else if (plan == com.example.cafemangmentsystem.tenant.entity.SubscriptionPlan.PRO) {
                tenant.setMaxTables(25);
                tenant.setMaxUsers(8);
                tenant.setMaxProducts(1000);
                tenant.setStatus(TenantStatus.ACTIVE);
                tenant.setSubscriptionEndsAt(java.time.Instant.now().plus(30, java.time.temporal.ChronoUnit.DAYS));
            } else if (plan == com.example.cafemangmentsystem.tenant.entity.SubscriptionPlan.STARTER) {
                tenant.setMaxTables(10);
                tenant.setMaxUsers(4);
                tenant.setMaxProducts(100);
                tenant.setStatus(TenantStatus.ACTIVE);
                tenant.setSubscriptionEndsAt(java.time.Instant.now().plus(30, java.time.temporal.ChronoUnit.DAYS));
            } else {
                tenant.setMaxTables(5);
                tenant.setMaxUsers(2);
                tenant.setMaxProducts(30);
                tenant.setStatus(TenantStatus.TRIAL);
                if (tenant.getTrialEndsAt() == null) {
                    tenant.setTrialEndsAt(java.time.Instant.now().plus(14, java.time.temporal.ChronoUnit.DAYS));
                }
            }
        }
        tenant.setPlanSelected(true);

        Tenant saved = tenantRepository.save(tenant);

        tenantActivityLogRepository.save(com.example.cafemangmentsystem.tenant.entity.TenantActivityLog.builder()
                .tenantId(saved.getId())
                .action("PLAN_SELECTED")
                .details("Tenant selected plan: " + (plan != null ? plan.name() : "DEFAULT"))
                .performedBy("TENANT_ADMIN")
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

        com.example.cafemangmentsystem.tenant.entity.SubscriptionPlan plan = 
                request.subscriptionPlan() != null ? request.subscriptionPlan() : com.example.cafemangmentsystem.tenant.entity.SubscriptionPlan.PRO;
        TenantStatus status = plan == com.example.cafemangmentsystem.tenant.entity.SubscriptionPlan.TRIAL ? TenantStatus.TRIAL : TenantStatus.ACTIVE;
        java.time.Instant subEnd = plan == com.example.cafemangmentsystem.tenant.entity.SubscriptionPlan.TRIAL ? null : java.time.Instant.now().plus(30, java.time.temporal.ChronoUnit.DAYS);
        java.time.Instant trialEnd = plan == com.example.cafemangmentsystem.tenant.entity.SubscriptionPlan.TRIAL ? java.time.Instant.now().plus(14, java.time.temporal.ChronoUnit.DAYS) : null;

        Tenant tenant = Tenant.builder()
                .name(request.name())
                .slug(request.slug())
                .businessType(request.businessType())
                .status(status)
                .subscriptionPlan(plan)
                .maxTables(plan.getMaxTables())
                .maxUsers(plan.getMaxUsers())
                .maxProducts(plan.getMaxProducts())
                .subscriptionEndsAt(subEnd)
                .trialEndsAt(trialEnd)
                .planSelected(true)
                .ownerWhatsapp(request.ownerWhatsapp())
                .timezone(request.timezone() == null ? "Africa/Cairo" : request.timezone())
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

        // Dispatch instant background WhatsApp message to tenant owner with login credentials
        whatsAppService.sendTenantCredentials(tenant, request.ownerUsername(), request.ownerPassword(), null);

        String jwtToken = jwtService.generateToken(new com.example.cafemangmentsystem.security.UserPrincipal(owner));
        return new ProvisionTenantResponse(tenant.getId(), tenant.getSlug(), request.ownerUsername(), jwtToken);
    }
    
    @Transactional(readOnly = true)
    public java.util.Map<String, Object> getPlatformStats() {
        List<Tenant> customerTenants = tenantRepository.findAll().stream()
                .filter(t -> !"platform".equalsIgnoreCase(t.getSlug()))
                .toList();
        long totalTenants = customerTenants.size();
        long activeTenants = customerTenants.stream().filter(t -> t.getStatus() == TenantStatus.ACTIVE).count();
        long trialTenants = customerTenants.stream().filter(t -> t.getStatus() == TenantStatus.TRIAL).count();
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

    public TenantResponse customizeTenantPlan(Long tenantId, com.example.cafemangmentsystem.tenant.platform.PlatformAdminController.CustomizePlanRequest req) {
        Tenant tenant = tenantRepository.findById(tenantId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Tenant not found: " + tenantId));
        
        if (req.plan() != null) {
            tenant.setSubscriptionPlan(req.plan());
        }
        if (req.status() != null) {
            tenant.setStatus(req.status());
        }
        if (req.maxTables() != null) {
            tenant.setMaxTables(req.maxTables());
        }
        if (req.maxUsers() != null) {
            tenant.setMaxUsers(req.maxUsers());
        }
        if (req.maxProducts() != null) {
            tenant.setMaxProducts(req.maxProducts());
        }
        if (req.serviceChargePercent() != null) {
            tenant.setServiceChargePercent(req.serviceChargePercent());
        }
        if (req.whatsappAlertsEnabled() != null) {
            tenant.setWhatsappAlertsEnabled(req.whatsappAlertsEnabled());
        }
        if (req.subscriptionEndsAt() != null) {
            tenant.setSubscriptionEndsAt(req.subscriptionEndsAt());
        }
        if (req.trialEndsAt() != null) {
            tenant.setTrialEndsAt(req.trialEndsAt());
        }
        if (req.extendDays() != null && req.extendDays() > 0) {
            java.time.Instant base = tenant.getSubscriptionEndsAt() != null ? tenant.getSubscriptionEndsAt() : (tenant.getTrialEndsAt() != null ? tenant.getTrialEndsAt() : java.time.Instant.now());
            tenant.setSubscriptionEndsAt(base.plus(req.extendDays(), java.time.temporal.ChronoUnit.DAYS));
            tenant.setStatus(TenantStatus.ACTIVE);
        }
        tenant.setPlanSelected(true);

        Tenant saved = tenantRepository.save(tenant);

        tenantActivityLogRepository.save(com.example.cafemangmentsystem.tenant.entity.TenantActivityLog.builder()
                .tenantId(saved.getId())
                .action("PLAN_CUSTOMIZED")
                .details("Plan customized: " + saved.getSubscriptionPlan() + ", Tables: " + saved.getMaxTables() + ", Users: " + saved.getMaxUsers() + ", Products: " + saved.getMaxProducts())
                .performedBy("SUPER_ADMIN")
                .build());

        return TenantResponse.from(saved);
    }

    public TenantResponse updateLogo(Long tenantId, String logoUrl) {
        Tenant tenant = tenantRepository.findById(tenantId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Tenant not found"));
        tenant.setLogoUrl(logoUrl);
        Tenant saved = tenantRepository.save(tenant);
        tenantActivityLogRepository.save(com.example.cafemangmentsystem.tenant.entity.TenantActivityLog.builder()
                .tenantId(saved.getId())
                .action("LOGO_UPDATED")
                .details(logoUrl != null ? "Logo updated" : "Logo removed")
                .performedBy("TENANT_ADMIN")
                .build());
        return TenantResponse.from(saved);
    }

    @Transactional
    public void deleteTenant(Long tenantId) {
        Tenant tenant = tenantRepository.findById(tenantId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Tenant not found: " + tenantId));
        if ("platform".equalsIgnoreCase(tenant.getSlug())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Cannot delete master platform tenant");
        }
        userRepository.deleteAll(userRepository.findAll().stream().filter(u -> tenantId.equals(u.getTenantId())).toList());
        tenantActivityLogRepository.deleteAll(tenantActivityLogRepository.findByTenantIdOrderByCreatedAtDesc(tenantId));
        tenantRepository.delete(tenant);
    }

    @Transactional(readOnly = true)
    public java.util.Map<String, Object> getTenantUsageDetails(Long tenantId) {
        Tenant tenant = tenantRepository.findById(tenantId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Tenant not found"));

        var plan = tenant.getSubscriptionPlan() != null ? tenant.getSubscriptionPlan() : com.example.cafemangmentsystem.tenant.entity.SubscriptionPlan.TRIAL;
        int maxTables = tenant.getMaxTables() != null ? tenant.getMaxTables() : plan.getMaxTables();
        int maxUsers = tenant.getMaxUsers() != null ? tenant.getMaxUsers() : plan.getMaxUsers();
        int maxProducts = tenant.getMaxProducts() != null ? tenant.getMaxProducts() : plan.getMaxProducts();

        long tablesCount = cafeTableRepository.count();
        long usersCount = userRepository.count();
        long productsCount = productRepository.count();

        long daysRemaining = 0;
        if (tenant.getStatus() == TenantStatus.TRIAL && tenant.getTrialEndsAt() != null) {
            daysRemaining = Math.max(0, java.time.temporal.ChronoUnit.DAYS.between(java.time.Instant.now(), tenant.getTrialEndsAt()));
        } else if (tenant.getStatus() == TenantStatus.ACTIVE && tenant.getSubscriptionEndsAt() != null) {
            daysRemaining = Math.max(0, java.time.temporal.ChronoUnit.DAYS.between(java.time.Instant.now(), tenant.getSubscriptionEndsAt()));
        }

        java.util.Map<String, Object> usage = new java.util.LinkedHashMap<>();
        usage.put("tenantId", tenant.getId());
        usage.put("tenantName", tenant.getName());
        usage.put("tenantSlug", tenant.getSlug());
        usage.put("status", tenant.getStatus().name());
        usage.put("plan", plan.name());
        usage.put("planDisplayName", plan.getDisplayName());
        usage.put("tablesUsed", tablesCount);
        usage.put("maxTables", maxTables);
        usage.put("usersUsed", usersCount);
        usage.put("maxUsers", maxUsers);
        usage.put("productsUsed", productsCount);
        usage.put("maxProducts", maxProducts);
        usage.put("daysRemaining", daysRemaining);
        usage.put("logoUrl", tenant.getLogoUrl() != null ? tenant.getLogoUrl() : "");
        usage.put("includesKds", plan.isIncludesKds());
        usage.put("includesExpenses", plan.isIncludesExpenses());
        return usage;
    }

    @Transactional(readOnly = true)
    public List<com.example.cafemangmentsystem.tenant.entity.TenantActivityLog> getTenantActivityLogs(Long tenantId) {
        return tenantActivityLogRepository.findByTenantIdOrderByCreatedAtDesc(tenantId);
    }
}








