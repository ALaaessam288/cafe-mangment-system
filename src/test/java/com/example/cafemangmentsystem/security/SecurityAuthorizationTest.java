package com.example.cafemangmentsystem.security;

import com.example.cafemangmentsystem.common.tenant.TenantContext;
import com.example.cafemangmentsystem.tenant.QuotaService;
import com.example.cafemangmentsystem.user.UserController;
import com.example.cafemangmentsystem.user.UserService;
import com.example.cafemangmentsystem.user.dto.CreateUserRequest;
import com.example.cafemangmentsystem.user.dto.UpdateUserRequest;
import com.example.cafemangmentsystem.user.entity.Role;
import com.example.cafemangmentsystem.user.entity.User;
import com.example.cafemangmentsystem.user.repository.UserRepository;
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

    private static class FakeUserRepository implements UserRepository {
        private final Map<Long, User> db = new HashMap<>();

        @Override
        public Optional<User> findById(Long id) {
            return Optional.ofNullable(db.get(id));
        }

        @Override
        public List<User> findAllByTenantIdAndUsername(Long tenantId, String username) {
            return db.values().stream()
                    .filter(u -> Objects.equals(u.getTenantId(), tenantId) && Objects.equals(u.getUsername(), username))
                    .collect(Collectors.toList());
        }

        @Override
        public Optional<User> findByUsername(String username) {
            return db.values().stream()
                    .filter(u -> Objects.equals(u.getUsername(), username))
                    .findFirst();
        }

        @Override
        public <S extends User> S save(S entity) {
            if (entity.getId() == null) {
                entity.setId((long) (db.size() + 1));
            }
            db.put(entity.getId(), entity);
            return entity;
        }

        @Override public long count() { return db.size(); }
        @Override public List<User> findAll() { return new ArrayList<>(db.values()); }
        @Override public boolean existsById(Long aLong) { return db.containsKey(aLong); }
        @Override public void deleteById(Long aLong) { db.remove(aLong); }
        @Override public void delete(User entity) { db.remove(entity.getId()); }
        @Override public void deleteAllById(Iterable<? extends Long> longs) {}
        @Override public void deleteAll(Iterable<? extends User> entities) {}
        @Override public void deleteAll() { db.clear(); }
        @Override public <S extends User> List<S> saveAll(Iterable<S> entities) { return Collections.emptyList(); }
        @Override public List<User> findAllById(Iterable<Long> longs) { return Collections.emptyList(); }
        @Override public void flush() {}
        @Override public <S extends User> S saveAndFlush(S entity) { return save(entity); }
        @Override public <S extends User> List<S> saveAllAndFlush(Iterable<S> entities) { return Collections.emptyList(); }
        @Override public void deleteAllInBatch(Iterable<User> entities) {}
        @Override public void deleteAllByIdInBatch(Iterable<Long> longs) {}
        @Override public void deleteAllInBatch() {}
        @Override public User getOne(Long aLong) { return db.get(aLong); }
        @Override public User getById(Long aLong) { return db.get(aLong); }
        @Override public User getReferenceById(Long aLong) { return db.get(aLong); }
        @Override public <S extends User> Optional<S> findOne(org.springframework.data.domain.Example<S> example) { return Optional.empty(); }
        @Override public <S extends User> List<S> findAll(org.springframework.data.domain.Example<S> example) { return Collections.emptyList(); }
        @Override public <S extends User> List<S> findAll(org.springframework.data.domain.Example<S> example, org.springframework.data.domain.Sort sort) { return Collections.emptyList(); }
        @Override public <S extends User> org.springframework.data.domain.Page<S> findAll(org.springframework.data.domain.Example<S> example, org.springframework.data.domain.Pageable pageable) { return null; }
        @Override public <S extends User> long count(org.springframework.data.domain.Example<S> example) { return 0; }
        @Override public <S extends User> boolean exists(org.springframework.data.domain.Example<S> example) { return false; }
        @Override public <S extends User, R> R findBy(org.springframework.data.domain.Example<S> example, java.util.function.Function<org.springframework.data.repository.query.FluentQuery.FetchableFluentQuery<S>, R> queryFunction) { return null; }
        @Override public List<User> findAll(org.springframework.data.domain.Sort sort) { return Collections.emptyList(); }
        @Override public org.springframework.data.domain.Page<User> findAll(org.springframework.data.domain.Pageable pageable) { return null; }
    }

    private static class FakePasswordEncoder implements PasswordEncoder {
        @Override public String encode(CharSequence raw) { return "encoded_" + raw; }
        @Override public boolean matches(CharSequence raw, String encoded) { return ("encoded_" + raw).equals(encoded); }
    }

    private FakeUserRepository fakeUserRepository;
    private UserService userService;
    private UserController userController;
    private UserPrincipal adminPrincipal;
    private UserPrincipal supervisorPrincipal;

    @BeforeEach
    public void setUp() {
        fakeUserRepository = new FakeUserRepository();
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
