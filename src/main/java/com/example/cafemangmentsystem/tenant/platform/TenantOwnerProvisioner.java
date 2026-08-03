package com.example.cafemangmentsystem.tenant.platform;

import com.example.cafemangmentsystem.user.entity.Role;
import com.example.cafemangmentsystem.user.entity.User;
import com.example.cafemangmentsystem.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/**
 * Separate bean (not just a private method on TenantService) so {@code REQUIRES_NEW} actually
 * takes effect - Spring's transaction proxying only kicks in on a call through a different bean,
 * not a self-invocation. Needed because Hibernate resolves a Session's {@code @TenantId} value
 * once, at session-open time: TenantService.provision() already touched the DB (checking slug
 * uniqueness) before the new tenant's id existed, so whatever session that opened is permanently
 * tagged with "no tenant". REQUIRES_NEW forces this insert onto a genuinely fresh session -
 * the caller must set {@code TenantContext} to the real tenant id *before* calling this, since
 * the new session can be opened as early as this method's transactional proxy boundary.
 */
@Component
@RequiredArgsConstructor
public class TenantOwnerProvisioner {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void createOwner(String username, String fullName, String rawPassword) {
        User owner = User.builder()
                .username(username)
                .fullName(fullName)
                .passwordHash(passwordEncoder.encode(rawPassword))
                .role(Role.ADMIN)
                .build();
        userRepository.save(owner);
    }
}
