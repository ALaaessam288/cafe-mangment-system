package com.example.cafemangmentsystem.tenant;

import com.example.cafemangmentsystem.common.exception.QuotaExceededException;
import com.example.cafemangmentsystem.common.tenant.TenantContext;
import com.example.cafemangmentsystem.tenant.entity.SubscriptionPlan;
import com.example.cafemangmentsystem.tenant.entity.Tenant;
import com.example.cafemangmentsystem.tenant.repository.TenantRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class QuotaService {
    
    private final TenantRepository tenantRepository;
    
    public void checkTableQuota(long currentCount) {
        Tenant tenant = getCurrentTenant();
        if (tenant == null) return;
        SubscriptionPlan plan = tenant.getSubscriptionPlan() != null ? tenant.getSubscriptionPlan() : SubscriptionPlan.TRIAL;
        int max = tenant.getMaxTables() != null ? tenant.getMaxTables() : plan.getMaxTables();
        if (max > 0 && currentCount >= max) {
            throw new QuotaExceededException("لقد وصلت للحد الأقصى لعدد الطاولات المسموح بها في باقتك (" + max + " طاولة). يرجى ترقية الباقة لإضافة المزيد.");
        }
    }
    
    public void checkUserQuota(long currentCount) {
        Tenant tenant = getCurrentTenant();
        if (tenant == null) return;
        SubscriptionPlan plan = tenant.getSubscriptionPlan() != null ? tenant.getSubscriptionPlan() : SubscriptionPlan.TRIAL;
        int max = tenant.getMaxUsers() != null ? tenant.getMaxUsers() : plan.getMaxUsers();
        if (max > 0 && currentCount >= max) {
            throw new QuotaExceededException("لقد وصلت للحد الأقصى لعدد المستخدمين المسموح بهم في باقتك (" + max + " مستخدم). يرجى ترقية الباقة لإضافة المزيد.");
        }
    }
    
    public void checkProductQuota(long currentCount) {
        Tenant tenant = getCurrentTenant();
        if (tenant == null) return;
        SubscriptionPlan plan = tenant.getSubscriptionPlan() != null ? tenant.getSubscriptionPlan() : SubscriptionPlan.TRIAL;
        int max = tenant.getMaxProducts() != null ? tenant.getMaxProducts() : plan.getMaxProducts();
        if (max > 0 && currentCount >= max) {
            throw new QuotaExceededException("لقد وصلت للحد الأقصى لعدد المنتجات المسموح بها في باقتك (" + max + " منتج). يرجى ترقية الباقة لإضافة المزيد.");
        }
    }
    
    private Tenant getCurrentTenant() {
        Long tenantId = TenantContext.get();
        if (tenantId == null) return null;
        return tenantRepository.findById(tenantId).orElse(null);
    }
}
