package com.example.cafemangmentsystem.security;

import com.example.cafemangmentsystem.common.tenant.TenantContext;
import com.example.cafemangmentsystem.billing.QuotaService;
import com.example.cafemangmentsystem.user.UserController;
import com.example.cafemangmentsystem.user.UserService;
import com.example.cafemangmentsystem.user.dto.CreateUserRequest;
import com.example.cafemangmentsystem.user.dto.UpdateUserRequest;
import com.example.cafemangmentsystem.user.entity.Role;
import com.example.cafemangmentsystem.user.entity.User;
import com.example.cafemangmentsystem.user.InMemoryUserRepository;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.server.ResponseStatusException;

import java.util.*;
import java.util.stream.Collectors;

import static org.junit.jupiter.api.Assertions.*;

public class SecurityAuthorizationTest {

    private static class FakePasswordEncoder implements PasswordEncoder {
        @Override public String encode(CharSequence raw) { return "encoded_" + raw; }
        @Override public boolean matches(CharSequence raw, String encoded) { return ("encoded_" + raw).equals(encoded); }
    }

    private InMemoryUserRepository fakeUserRepository;
    private UserService userService;
    private UserController userController;
    private UserPrincipal adminPrincipal;
    private UserPrincipal supervisorPrincipal;

    @BeforeEach
    public void setUp() {
        fakeUserRepository = new InMemoryUserRepository();
        PasswordEncoder passwordEncoder = new FakePasswordEncoder();
        QuotaService quotaService = new QuotaService(null);
        userService = new UserService(fakeUserRepository, passwordEncoder, quotaService);
        userController = new UserController(userService);
        TenantContext.set(1L);

        User adminUser = new User();
        adminUser.setId(10L);
        adminUser.setTenantId(1L);
        adminUser.setUsername("admin1");
        adminUser.setPasswordHash("encoded_pass");
        adminUser.setFullName("Admin One");
        adminUser.setRole(Role.ADMIN);
        adminUser.setActive(true);
        fakeUserRepository.save(adminUser);
        adminPrincipal = new UserPrincipal(adminUser);

        User supervisorUser = new User();
        supervisorUser.setId(20L);
        supervisorUser.setTenantId(1L);
        supervisorUser.setUsername("supervisor1");
        supervisorUser.setPasswordHash("encoded_pass");
        supervisorUser.setFullName("Supervisor One");
        supervisorUser.setRole(Role.SUPERVISOR);
        supervisorUser.setActive(true);
        fakeUserRepository.save(supervisorUser);
        supervisorPrincipal = new UserPrincipal(supervisorUser);
    }

    @AfterEach
    public void tearDown() {
        TenantContext.clear();
    }

    @Test
    public void adminCannotAssignSuperAdminRole() {
        CreateUserRequest req = new CreateUserRequest("baduser", "pass12345", "Bad User", null, Role.SUPER_ADMIN);
        ResponseStatusException ex = assertThrows(ResponseStatusException.class, () -> {
            userController.create(req, adminPrincipal);
        });
        assertEquals(HttpStatus.FORBIDDEN, ex.getStatusCode());
        assertTrue(ex.getReason().contains("SUPER_ADMIN"));
    }

    @Test
    public void supervisorCannotCreateAdminRole() {
        CreateUserRequest req = new CreateUserRequest("newadmin", "pass12345", "New Admin", null, Role.ADMIN);
        ResponseStatusException ex = assertThrows(ResponseStatusException.class, () -> {
            userController.create(req, supervisorPrincipal);
        });
        assertEquals(HttpStatus.FORBIDDEN, ex.getStatusCode());
    }

    @Test
    public void supervisorCannotModifyAdminAccount() {
        UpdateUserRequest req = new UpdateUserRequest("Updated Name", "admin1", Role.CASHIER, null);
        ResponseStatusException ex = assertThrows(ResponseStatusException.class, () -> {
            userController.update(10L, req, supervisorPrincipal);
        });
        assertEquals(HttpStatus.FORBIDDEN, ex.getStatusCode());
    }

    @Test
    public void rateLimiterLocksOutAfterFiveFailures() {
        RateLimiterService rateLimiter = new RateLimiterService();
        String key = "TEST:ip-123";

        // First 4 attempts fail without lockout
        for (int i = 0; i < 4; i++) {
            rateLimiter.checkLockout(key);
            rateLimiter.recordFailure(key);
        }

        // 5th failure triggers lockout
        rateLimiter.recordFailure(key);

        // Subsequent check throws 429 Too Many Requests
        ResponseStatusException ex = assertThrows(ResponseStatusException.class, () -> {
            rateLimiter.checkLockout(key);
        });
        assertEquals(HttpStatus.TOO_MANY_REQUESTS, ex.getStatusCode());

        // Reset clears lockout
        rateLimiter.reset(key);
        assertDoesNotThrow(() -> rateLimiter.checkLockout(key));
    }
}
