package com.example.cafemangmentsystem.billing;

import com.example.cafemangmentsystem.billing.dto.Entitlements;
import com.example.cafemangmentsystem.billing.entity.QuotaType;
import com.example.cafemangmentsystem.common.exception.QuotaExceededException;
import com.example.cafemangmentsystem.common.tenant.TenantContext;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.function.LongSupplier;

/**
 * Enforces the countable limits.
 *
 * <p>Two bugs from the previous implementation are fixed by construction here. It guarded with
 * {@code if (max > 0 && count >= max)}, so a limit of {@code 0} disabled enforcement entirely
 * rather than blocking everything — the inverse of the intent. And it had no way to express
 * "unlimited" except 9999, which it then enforced as a real ceiling. Now {@code 0} blocks and
 * {@link QuotaType#UNLIMITED} (-1) is the only thing that doesn't.
 */
@Service
@RequiredArgsConstructor
public class QuotaService {

    private final EntitlementService entitlementService;

    /** Result of a quota question, useful for both enforcement and the usage endpoint. */
    public record QuotaState(QuotaType type, long used, int limit, boolean unlimited) {
        public boolean exceeded() {
            return !unlimited && used >= limit;
        }

        public Integer remaining() {
            return unlimited ? null : (int) Math.max(0, limit - used);
        }
    }

    public QuotaState state(QuotaType type, long currentCount) {
        Entitlements entitlements = entitlementService.forTenant(TenantContext.get());
        int limit = entitlements.limit(type);
        return new QuotaState(type, currentCount, limit, QuotaType.isUnlimited(limit));
    }

    /**
     * Throws if adding one more of {@code type} would breach the plan.
     *
     * @param countSupplier evaluated lazily — an unlimited plan never runs the count query.
     */
    public void check(QuotaType type, LongSupplier countSupplier) {
        Long tenantId = TenantContext.get();
        if (tenantId == null) return;

        Entitlements entitlements = entitlementService.forTenant(tenantId);
        int limit = entitlements.limit(type);
        if (QuotaType.isUnlimited(limit)) return;

        long used = countSupplier.getAsLong();
        if (used >= limit) {
            throw new QuotaExceededException(message(type, limit));
        }
    }

    public void checkTables(LongSupplier count) { check(QuotaType.TABLES, count); }

    public void checkUsers(LongSupplier count) { check(QuotaType.USERS, count); }

    public void checkProducts(LongSupplier count) { check(QuotaType.PRODUCTS, count); }

    private String message(QuotaType type, int limit) {
        return "لقد وصلت للحد الأقصى لعدد " + type.getDisplayNameAr()
                + " المسموح به في باقتك (" + limit + " " + type.getUnitAr() + ")."
                + " يرجى ترقية الباقة لإضافة المزيد.";
    }
}
