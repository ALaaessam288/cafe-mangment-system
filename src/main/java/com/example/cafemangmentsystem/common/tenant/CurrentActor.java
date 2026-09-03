package com.example.cafemangmentsystem.common.tenant;

import com.example.cafemangmentsystem.security.UserPrincipal;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;

/**
 * Who is performing the current action, for audit rows.
 *
 * <p>The platform audit log used to record the literal string {@code "SYSTEM_OR_ADMIN"} for every
 * subscription change, which made it useless for the one question an audit log exists to answer.
 */
public final class CurrentActor {

    public static final String SYSTEM = "SYSTEM";

    private CurrentActor() {
    }

    /** Username of the authenticated principal, or {@link #SYSTEM} for scheduled/bootstrap work. */
    public static String name() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || !authentication.isAuthenticated()) {
            return SYSTEM;
        }
        Object principal = authentication.getPrincipal();
        if (principal instanceof UserPrincipal userPrincipal) {
            return userPrincipal.getUsername();
        }
        String name = authentication.getName();
        return name == null || name.isBlank() || "anonymousUser".equals(name) ? SYSTEM : name;
    }
}
