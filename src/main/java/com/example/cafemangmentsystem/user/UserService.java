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
        if (userRepository.findByUsername(request.username()).isPresent()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Username already taken: " + request.username());
        }
        
        quotaService.checkUserQuota(userRepository.count());

        User user = User.builder()
                .username(request.username())
                .fullName(request.fullName())
                .passwordHash(passwordEncoder.encode(request.password()))
                .pinHash(request.pin() == null ? null : passwordEncoder.encode(request.pin()))
                .role(request.role())
                .build();

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
        User user = getOrThrow(id);
        user.setFullName(request.fullName());
        user.setRole(request.role());
        if (request.username() != null && !request.username().isBlank() && !request.username().equals(user.getUsername())) {
            userRepository.findByUsername(request.username().trim()).ifPresent(existing -> {
                if (!existing.getId().equals(user.getId())) {
                    throw new ResponseStatusException(HttpStatus.CONFLICT, "اسم المستخدم مستخدم بالفعل");
                }
            });
            user.setUsername(request.username().trim());
        }
        if (request.pin() != null) {
            user.setPinHash(passwordEncoder.encode(request.pin()));
        }
        return UserResponse.from(user);
    }

    public void changePassword(Long id, ChangePasswordRequest request) {
        User user = getOrThrow(id);
        user.setPasswordHash(passwordEncoder.encode(request.newPassword()));
    }

    public UserResponse deactivate(Long id, Long deactivatedByUserId) {
        User user = getOrThrow(id);
        user.deactivate(deactivatedByUserId);
        return UserResponse.from(user);
    }

    public UserResponse activate(Long id) {
        User user = getOrThrow(id);
        user.activate();
        return UserResponse.from(user);
    }

    private User getOrThrow(Long id) {
        return userRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found: " + id));
    }
}