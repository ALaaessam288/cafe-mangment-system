package com.example.cafemangmentsystem.user.repository;

import com.example.cafemangmentsystem.user.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface UserRepository extends JpaRepository<User, Long> {

    /**
     * Scoped to the current tenant automatically by Hibernate's {@code @TenantId} filter (see
     * {@code TenantScopedEntity}), driven by whatever {@code TenantContext} holds at call time.
     * Hibernate does not allow the discriminator column itself to also appear as an explicit
     * derived-query parameter, so callers (login, JwtAuthenticationFilter) must set
     * {@code TenantContext} before calling this rather than passing a tenantId here.
     */
    Optional<User> findByUsername(String username);
}