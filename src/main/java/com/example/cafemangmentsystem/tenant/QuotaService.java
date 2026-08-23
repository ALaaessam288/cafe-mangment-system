package com.example.cafemangmentsystem.tenant;

import com.example.cafemangmentsystem.common.exception.QuotaExceededException;
import com.example.cafemangmentsystem.common.tenant.TenantContext;
import com.example.cafemangmentsystem.tenant.entity.Tenant;
import com.example.cafemangmentsystem.tenant.repository.TenantRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class QuotaService {
    
    private final TenantRepository tenantRepository;
    
    public void checkTableQuota(long currentCount) {
        // Unlimited
    }
    
    public void checkUserQuota(long currentCount) {
        // Unlimited
    }
    
    public void checkProductQuota(long currentCount) {
        // Unlimited
    }
    
    private Tenant getCurrentTenant() {
        Long tenantId = TenantContext.get();
        if (tenantId == null) return null;
        return tenantRepository.findById(tenantId).orElse(null);
    }
}
