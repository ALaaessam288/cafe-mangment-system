package com.example.cafemangmentsystem.security;

import com.example.cafemangmentsystem.common.tenant.TenantContext;
import com.example.cafemangmentsystem.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

@Service
@RequiredArgsConstructor
public class CustomUserDetailsService implements UserDetailsService {

    private final UserRepository userRepository;

    /**
     * Requires {@link TenantContext} to already be set (by the login flow or
     * JwtAuthenticationFilter, both of which resolve the tenant before calling this) - usernames
     * are only unique per tenant, so looking one up without a tenant is meaningless.
     */
    private static final Logger log = LoggerFactory.getLogger(CustomUserDetailsService.class);

    @Override
    public UserDetails loadUserByUsername(String username) throws UsernameNotFoundException {
        // Log tenant context and username for debugging
        Long tenantId = TenantContext.get();
        log.debug("Loading user '{}', tenantId={}", username, tenantId);
        if (tenantId == null) {
            log.warn("No tenant context for username: {}", username);
            throw new UsernameNotFoundException("No tenant context for username: " + username);
        }
        return userRepository.findByUsername(username)
                .map(UserPrincipal::new)
                .orElseThrow(() -> {
                    log.warn("User not found: {} for tenantId={}", username, tenantId);
                    return new UsernameNotFoundException("User not found: " + username);
                });
    }
}