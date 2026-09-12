package com.example.cafemangmentsystem.tenant.platform;

import com.example.cafemangmentsystem.user.InMemoryUserRepository;
import com.example.cafemangmentsystem.user.entity.Role;
import com.example.cafemangmentsystem.user.entity.User;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.crypto.password.PasswordEncoder;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class PlatformAdminSaverTest {

    private InMemoryUserRepository users;
    private PlatformAdminSaver saver;

    @BeforeEach
    void setUp() {
        users = new InMemoryUserRepository();
        PasswordEncoder encoder = new PasswordEncoder() {
            @Override
            public String encode(CharSequence rawPassword) {
                return "encoded:" + rawPassword;
            }

            @Override
            public boolean matches(CharSequence rawPassword, String encodedPassword) {
                return ("encoded:" + rawPassword).equals(encodedPassword);
            }
        };
        saver = new PlatformAdminSaver(users, encoder);
    }

    @Test
    void recoveryCreatesMissingSuperAdminInsidePlatformTenant() {
        User admin = saver.upsertSuperAdmin(77L, "owner@caffio.app", "Platform Owner", "NewSecure1234");

        assertEquals(77L, admin.getTenantId());
        assertEquals(Role.SUPER_ADMIN, admin.getRole());
        assertEquals("encoded:NewSecure1234", admin.getPasswordHash());
        assertTrue(admin.isActive());
        assertEquals(1, users.count());
    }

    @Test
    void recoveryReactivatesAndResetsMatchingExistingAccount() {
        User existing = new User();
        existing.setId(9L);
        existing.setTenantId(77L);
        existing.setUsername("owner@caffio.app");
        existing.setFullName("Old Name");
        existing.setPasswordHash("encoded:OldPassword1");
        existing.setRole(Role.ADMIN);
        existing.deactivate();
        users.save(existing);

        User recovered = saver.upsertSuperAdmin(77L, "owner@caffio.app", "Alaa Essam", "NewSecure1234");

        assertEquals(9L, recovered.getId());
        assertEquals("Alaa Essam", recovered.getFullName());
        assertEquals("encoded:NewSecure1234", recovered.getPasswordHash());
        assertEquals(Role.SUPER_ADMIN, recovered.getRole());
        assertTrue(recovered.isActive());
        assertEquals(1, users.count());
    }
}
