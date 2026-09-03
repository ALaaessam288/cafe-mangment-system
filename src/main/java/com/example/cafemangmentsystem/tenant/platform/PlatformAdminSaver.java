package com.example.cafemangmentsystem.tenant.platform;

import com.example.cafemangmentsystem.user.entity.Role;
import com.example.cafemangmentsystem.user.entity.User;
import com.example.cafemangmentsystem.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

/**
 * Writes the platform's SUPER_ADMIN on a genuinely fresh Hibernate session.
 *
 * <p>A separate bean for the same reason as {@link TenantOwnerProvisioner}: {@code REQUIRES_NEW}
 * only takes effect across a proxy boundary, and Hibernate resolves a session's {@code @TenantId}
 * once, when the session opens. Setting {@code TenantContext} inside an already-transactional
 * method is too late — the first version of the bootstrap did exactly that and wrote the platform
 * owner with {@code tenant_id = 0}, so the account existed in the database and could never log in.
 * The caller must set the context <em>before</em> calling either method here.
 */
@Component
@RequiredArgsConstructor
public class PlatformAdminSaver {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    /** Requires {@code TenantContext} to already hold the platform tenant's id. */
    @Transactional(propagation = Propagation.REQUIRES_NEW, readOnly = true)
    public boolean superAdminExists() {
        List<User> users = userRepository.findAll();
        return users.stream().anyMatch(user -> user.getRole() == Role.SUPER_ADMIN);
    }

    /** Requires {@code TenantContext} to already hold the platform tenant's id. */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public User createSuperAdmin(String username, String fullName, String rawPassword) {
        User admin = new User();
        admin.setUsername(username);
        admin.setFullName(fullName);
        admin.setPasswordHash(passwordEncoder.encode(rawPassword));
        admin.setRole(Role.SUPER_ADMIN);
        return userRepository.save(admin);
    }
}
