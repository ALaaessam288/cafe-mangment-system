package com.example.cafemangmentsystem.register;

import com.example.cafemangmentsystem.register.dto.RegisterRequest;
import com.example.cafemangmentsystem.register.dto.RegisterResponse;
import com.example.cafemangmentsystem.register.entity.Register;
import com.example.cafemangmentsystem.register.repository.RegisterRepository;
import com.example.cafemangmentsystem.billing.EntitlementService;
import com.example.cafemangmentsystem.billing.entity.Feature;
import com.example.cafemangmentsystem.common.tenant.TenantContext;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

@Service
@RequiredArgsConstructor
@Transactional
public class RegisterService {

    private final RegisterRepository registerRepository;
    private final EntitlementService entitlementService;

    /**
     * Creates a cash drawer.
     *
     * <p>The first one is always allowed: a café cannot open a shift without a drawer, so refusing it
     * would refuse the product. Additional drawers are what MULTI_REGISTER sells, so the check is a
     * count, not a blanket gate on the endpoint.
     */
    public RegisterResponse create(RegisterRequest request) {
        if (registerRepository.count() > 0) {
            Long tenantId = TenantContext.get();
            boolean allowed = tenantId == null
                    || entitlementService.forTenant(tenantId).has(Feature.MULTI_REGISTER);
            if (!allowed) {
                throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                        "باقتك الحالية تسمح بدرج واحد فقط. يرجى ترقية الباقة لإضافة أدراج إضافية.");
            }
        }

        Register register = new Register();
        register.setName(request.name());

        return RegisterResponse.from(registerRepository.save(register));
    }

    public List<RegisterResponse> findAll() {
        List<Register> list = registerRepository.findAll();
        if (list.isEmpty()) {
            Register defaultRegister = new Register();
            defaultRegister.setName("الكاشير الرئيسي (الدرج 1)");
            list = List.of(registerRepository.save(defaultRegister));
        }
        return list.stream()
                .map(RegisterResponse::from)
                .toList();
    }

    @Transactional(readOnly = true)
    public RegisterResponse findById(Long id) {
        return RegisterResponse.from(getOrThrow(id));
    }

    public RegisterResponse update(Long id, RegisterRequest request) {
        Register register = getOrThrow(id);
        register.setName(request.name());
        return RegisterResponse.from(register);
    }

    public RegisterResponse deactivate(Long id, Long deactivatedByUserId) {
        Register register = getOrThrow(id);
        register.deactivate(deactivatedByUserId);
        return RegisterResponse.from(register);
    }

    public RegisterResponse activate(Long id) {
        Register register = getOrThrow(id);
        register.activate();
        return RegisterResponse.from(register);
    }

    private Register getOrThrow(Long id) {
        return registerRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Register not found: " + id));
    }
}
