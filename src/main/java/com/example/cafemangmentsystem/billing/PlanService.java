package com.example.cafemangmentsystem.billing;

import com.example.cafemangmentsystem.billing.dto.PlanDto;
import com.example.cafemangmentsystem.billing.entity.Feature;
import com.example.cafemangmentsystem.billing.entity.Plan;
import com.example.cafemangmentsystem.billing.entity.QuotaType;
import com.example.cafemangmentsystem.billing.repository.PlanRepository;
import com.example.cafemangmentsystem.billing.repository.TenantSubscriptionRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

/** Reads and edits the plan catalogue. Editing a plan never touches an existing subscription's price. */
@Service
@RequiredArgsConstructor
@Transactional
public class PlanService {

    private final PlanRepository planRepository;
    private final TenantSubscriptionRepository subscriptionRepository;
    private final EntitlementService entitlementService;

    @Transactional(readOnly = true)
    public List<PlanDto> publicCatalogue() {
        return planRepository.findByActiveTrueOrderBySortOrderAsc().stream()
                .filter(plan -> !plan.isCustomPlan())
                .map(PlanDto::from)
                .toList();
    }

    @Transactional(readOnly = true)
    public List<PlanDto> all() {
        return planRepository.findAllByOrderBySortOrderAsc().stream().map(PlanDto::from).toList();
    }

    @Transactional(readOnly = true)
    public Plan requireByCode(String code) {
        return planRepository.findByCode(code)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Unknown plan: " + code));
    }

    public PlanDto create(PlanUpsert request) {
        if (planRepository.existsByCode(request.code())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Plan code already exists: " + request.code());
        }
        Plan plan = new Plan();
        plan.setCode(request.code().trim().toUpperCase(java.util.Locale.ROOT));
        apply(plan, request);
        entitlementService.invalidateAll();
        return PlanDto.from(planRepository.save(plan));
    }

    public PlanDto update(Long id, PlanUpsert request) {
        Plan plan = planRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Plan not found: " + id));
        apply(plan, request);
        Plan saved = planRepository.save(plan);
        // Limits and features are read live from the plan, so every tenant on it is affected now.
        entitlementService.invalidateAll();
        return PlanDto.from(saved);
    }

    /**
     * Retires a plan. Deliberately not a delete: existing subscriptions reference it, and their
     * invoices name it. A retired plan stops being sellable and disappears from the pricing grid.
     */
    public PlanDto retire(Long id) {
        Plan plan = planRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Plan not found: " + id));
        plan.setActive(false);
        plan.setSelfSelectable(false);
        entitlementService.invalidateAll();
        return PlanDto.from(planRepository.save(plan));
    }

    @Transactional(readOnly = true)
    public long subscriberCount(Long planId) {
        return subscriptionRepository.countCurrentByPlan(planId);
    }

    private void apply(Plan plan, PlanUpsert request) {
        plan.setDisplayNameAr(require(request.displayName(), "displayName"));
        plan.setDisplayNameEn(request.displayNameEn());
        plan.setDescription(request.description());
        plan.setPrice(request.price() != null ? request.price() : BigDecimal.ZERO);
        plan.setCurrency(request.currency() != null ? request.currency() : "EGP");
        plan.setBillingPeriodDays(positive(request.billingPeriodDays(), 30, "billingPeriodDays"));
        plan.setTrialDays(request.trialDays() != null ? Math.max(0, request.trialDays()) : 0);
        plan.setMaxTables(limit(request.maxTables(), "maxTables"));
        plan.setMaxUsers(limit(request.maxUsers(), "maxUsers"));
        plan.setMaxProducts(limit(request.maxProducts(), "maxProducts"));
        plan.setSortOrder(request.sortOrder() != null ? request.sortOrder() : 0);
        plan.setActive(request.active() == null || request.active());
        plan.setSelfSelectable(Boolean.TRUE.equals(request.selfSelectable()));
        plan.setCustomPlan(Boolean.TRUE.equals(request.customPlan()));

        Set<Feature> features = new LinkedHashSet<>();
        if (request.features() != null) {
            for (String code : request.features()) {
                try {
                    features.add(Feature.valueOf(code.trim().toUpperCase(java.util.Locale.ROOT)));
                } catch (IllegalArgumentException unknown) {
                    throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Unknown feature: " + code);
                }
            }
        }
        plan.setFeatures(features);
    }

    private String require(String value, String field) {
        if (value == null || value.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, field + " is required");
        }
        return value.trim();
    }

    private int positive(Integer value, int fallback, String field) {
        if (value == null) return fallback;
        if (value < 1) throw new ResponseStatusException(HttpStatus.BAD_REQUEST, field + " must be at least 1");
        return value;
    }

    /** -1 is unlimited; 0 would mean "nothing allowed", which is never a plan anyone sells. */
    private int limit(Integer value, String field) {
        if (value == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, field + " is required");
        }
        if (value == QuotaType.UNLIMITED) return value;
        if (value < 1 || value > 100_000) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    field + " must be -1 (unlimited) or between 1 and 100000");
        }
        return value;
    }

    /** Create/update payload for a plan. */
    public record PlanUpsert(
            String code,
            String displayName,
            String displayNameEn,
            String description,
            BigDecimal price,
            String currency,
            Integer billingPeriodDays,
            Integer trialDays,
            Integer maxTables,
            Integer maxUsers,
            Integer maxProducts,
            List<String> features,
            Integer sortOrder,
            Boolean active,
            Boolean selfSelectable,
            Boolean customPlan
    ) {}
}
