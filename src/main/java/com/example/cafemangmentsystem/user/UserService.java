package com.example.cafemangmentsystem.user;

import com.example.cafemangmentsystem.user.dto.ChangePasswordRequest;
import com.example.cafemangmentsystem.user.dto.CreateUserRequest;
import com.example.cafemangmentsystem.user.dto.UpdateUserRequest;
import com.example.cafemangmentsystem.user.dto.UserResponse;
import com.example.cafemangmentsystem.user.entity.User;
import com.example.cafemangmentsystem.user.repository.UserRepository;
import com.example.cafemangmentsystem.tenant.QuotaService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

@Service
@RequiredArgsConstructor
@Transactional
public class UserService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final QuotaService quotaService;

    /**
     * Uses REQUIRES_NEW so this runs in a brand-new Hibernate session.
     * Hibernate resolves the @TenantId value once, at session-open time.
     * By the time an authenticated request reaches here, TenantContext is
     * already set by the JwtAuthenticationFilter — but the surrounding
     * @Transactional session was opened BEFORE that, so it carries
     * tenant_id=0.  Forcing a new session here means the session opens
     * AFTER TenantContext is set, and Hibernate stamps the correct id.
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public UserResponse create(CreateUserRequest request) {
        validateTenantRole(request.role());
        Long tenantId = com.example.cafemangmentsystem.common.tenant.TenantContext.get();
        if (tenantId != null && userRepository.findByTenantIdAndUsername(tenantId, request.username().trim()).isPresent()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Username already taken: " + request.username());
        }
        
        quotaService.checkUserQuota(userRepository.count());

        if (request.pin() != null && !request.pin().isBlank()) {
            validateUniquePinInTenant(tenantId, null, request.pin().trim());
        }

        User user = new User();
        user.setUsername(request.username());
        user.setFullName(request.fullName());
        user.setPasswordHash(passwordEncoder.encode(request.password()));
        user.setPinHash(request.pin() == null || request.pin().isBlank() ? null : passwordEncoder.encode(request.pin().trim()));
        user.setRole(request.role());

        return UserResponse.from(userRepository.save(user));
    }

    @Transactional(readOnly = true)
    public List<UserResponse> findAll() {
        return userRepository.findAll().stream()
                .map(UserResponse::from)
                .toList();
    }

    @Transactional(readOnly = true)
    public UserResponse findById(Long id) {
        return UserResponse.from(getOrThrow(id));
    }

    public UserResponse update(Long id, UpdateUserRequest request) {
        validateTenantRole(request.role());
        User user = getOrThrow(id);
        if (user.getRole() == com.example.cafemangmentsystem.user.entity.Role.SUPER_ADMIN) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Platform identities cannot be managed through tenant APIs");
        }
        user.setFullName(request.fullName());
        user.setRole(request.role());
        if (request.username() != null && !request.username().isBlank() && !request.username().equals(user.getUsername())) {
            Long tenantId = com.example.cafemangmentsystem.common.tenant.TenantContext.get();
            if (tenantId != null) {
                userRepository.findByTenantIdAndUsername(tenantId, request.username().trim()).ifPresent(existing -> {
                    if (!existing.getId().equals(user.getId())) {
                        throw new ResponseStatusException(HttpStatus.CONFLICT, "اسم المستخدم مستخدم بالفعل");
                    }
                });
            }
            user.setUsername(request.username().trim());
        }
        if (request.pin() != null && !request.pin().isBlank()) {
            Long tenantId = com.example.cafemangmentsystem.common.tenant.TenantContext.get();
            validateUniquePinInTenant(tenantId != null ? tenantId : user.getTenantId(), user.getId(), request.pin().trim());
            user.setPinHash(passwordEncoder.encode(request.pin().trim()));
        }
        return UserResponse.from(user);
    }

    public void changePassword(Long id, ChangePasswordRequest request) {
        User user = getOrThrow(id);
        if (user.getRole() == com.example.cafemangmentsystem.user.entity.Role.SUPER_ADMIN) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Platform identities cannot be managed through tenant APIs");
        }
        user.setPasswordHash(passwordEncoder.encode(request.newPassword()));
    }

    public UserResponse deactivate(Long id, Long deactivatedByUserId) {
        User user = getOrThrow(id);
        if (user.getRole() == com.example.cafemangmentsystem.user.entity.Role.SUPER_ADMIN) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Platform identities cannot be managed through tenant APIs");
        }
        user.deactivate(deactivatedByUserId);
        return UserResponse.from(user);
    }

    public UserResponse activate(Long id) {
        User user = getOrThrow(id);
        if (user.getRole() == com.example.cafemangmentsystem.user.entity.Role.SUPER_ADMIN) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Platform identities cannot be managed through tenant APIs");
        }
        user.activate();
        return UserResponse.from(user);
    }

    private void validateUniquePinInTenant(Long tenantId, Long excludeUserId, String pin) {
        if (tenantId == null || pin == null || pin.isBlank()) return;
        List<User> tenantUsers = userRepository.findAllByTenantId(tenantId);
        for (User u : tenantUsers) {
            if (excludeUserId != null && excludeUserId.equals(u.getId())) {
                continue;
            }
            if (u.isActive() && u.getPinHash() != null && passwordEncoder.matches(pin, u.getPinHash())) {
                String existingName = u.getFullName() != null && !u.getFullName().isBlank() ? u.getFullName() : u.getUsername();
                throw new ResponseStatusException(HttpStatus.CONFLICT, "رمز PIN هذا مستخدم بالفعل للمستخدم (" + existingName + ") في هذا الكافيه. يرجى اختيار رمز PIN فريد.");
            }
        }
    }

    private void validateTenantRole(com.example.cafemangmentsystem.user.entity.Role role) {
        if (role == com.example.cafemangmentsystem.user.entity.Role.SUPER_ADMIN) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "SUPER_ADMIN is a platform-only role");
        }
    }

    private User getOrThrow(Long id) {
        return userRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found: " + id));
    }
}
