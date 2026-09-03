package com.example.cafemangmentsystem.billing.dto;

import com.example.cafemangmentsystem.billing.entity.Feature;
import com.example.cafemangmentsystem.billing.entity.Plan;
import com.example.cafemangmentsystem.billing.entity.QuotaType;

import java.math.BigDecimal;
import java.util.List;

/**
 * The pricing card, served from the database.
 *
 * <p>The onboarding modal and the super-admin grid both used to hardcode limits in JavaScript, and
 * both disagreed with the backend — the modal promised PRO customers 25 tables and unlimited menu
 * items while the server enforced 50 and 500. There is now one source for those numbers.
 */
public record PlanDto(
        Long id,
        String code,
        String displayName,
        String displayNameEn,
        String description,
        BigDecimal price,
        String currency,
        int billingPeriodDays,
        int trialDays,
        LimitDto limits,
        List<FeatureDto> features,
        int sortOrder,
        boolean active,
        boolean selfSelectable,
        boolean customPlan
) {
    public record LimitDto(int maxTables, int maxUsers, int maxProducts,
                           boolean tablesUnlimited, boolean usersUnlimited, boolean productsUnlimited) {
        public static LimitDto of(int tables, int users, int products) {
            return new LimitDto(tables, users, products,
                    QuotaType.isUnlimited(tables), QuotaType.isUnlimited(users), QuotaType.isUnlimited(products));
        }
    }

    public record FeatureDto(String code, String displayName) {
        public static FeatureDto of(Feature feature) {
            return new FeatureDto(feature.name(), feature.getDisplayNameAr());
        }
    }

    public static PlanDto from(Plan plan) {
        return new PlanDto(
                plan.getId(),
                plan.getCode(),
                plan.getDisplayNameAr(),
                plan.getDisplayNameEn(),
                plan.getDescription(),
                plan.getPrice(),
                plan.getCurrency(),
                plan.getBillingPeriodDays(),
                plan.getTrialDays(),
                LimitDto.of(plan.getMaxTables(), plan.getMaxUsers(), plan.getMaxProducts()),
                plan.featureSet().stream().map(FeatureDto::of).toList(),
                plan.getSortOrder(),
                plan.isActive(),
                plan.isSelfSelectable(),
                plan.isCustomPlan()
        );
    }
}
