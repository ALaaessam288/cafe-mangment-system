package com.example.cafemangmentsystem.auth;

import lombok.RequiredArgsConstructor;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/**
 * Separate bean (not a plain call inside AuthController) so {@code REQUIRES_NEW} actually takes
 * effect - Spring's transaction proxying only kicks in on a call through a different bean.
 * Needed because Hibernate resolves a Session's {@code @TenantId} value once, at session-open
 * time: by the point AuthController.login() calls this, something earlier in the request
 * (open-in-view, or the tenant-slug lookup) may already have opened a session before the tenant
 * was known, permanently tagging it "root" - which would make the username lookup inside
 * {@code authenticate()} search across ALL tenants instead of just this one, and fail if two
 * tenants happen to share a username. REQUIRES_NEW forces this call onto a genuinely fresh
 * session, opened only after the caller has set {@code TenantContext} to the real tenant id.
 */
@Component
@RequiredArgsConstructor
public class TenantAwareAuthenticator {

    private final AuthenticationManager authenticationManager;

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public Authentication authenticate(String username, String password) {
        return authenticationManager.authenticate(new UsernamePasswordAuthenticationToken(username, password));
    }
}
