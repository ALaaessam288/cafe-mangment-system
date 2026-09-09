package com.example.cafemangmentsystem.user;

import com.example.cafemangmentsystem.billing.QuotaService;
import com.example.cafemangmentsystem.common.tenant.TenantContext;
import com.example.cafemangmentsystem.security.UserPrincipal;
import com.example.cafemangmentsystem.user.dto.SelfPasswordRequest;
import com.example.cafemangmentsystem.user.dto.SelfPinRequest;
import com.example.cafemangmentsystem.user.entity.Role;
import com.example.cafemangmentsystem.user.entity.User;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.server.ResponseStatusException;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Regression cover for the settings screen's credential flows.
 *
 * <p>Before this, changing your own password went through the administrator reset endpoint. That
 * endpoint verifies no current password at all - the form collected one and discarded it - and is
 * gated to ADMIN/SUPERVISOR with a target check that only permits managing cashiers. The result was
 * both a hole and a wall: an unattended terminal was enough to take over the account signed into
 * it, while supervisors and cashiers could not change their own password at all.
 */
public class SelfServiceCredentialsTest {

    private InMemoryUserRepository repo;
    private UserService userService;
    private UserController controller;
    private User cashier;
    private User supervisor;

    private static class FakeEncoder implements PasswordEncoder {
        @Override public String encode(CharSequence raw) { return "enc:" + raw; }
        @Override public boolean matches(CharSequence raw, String encoded) { return ("enc:" + raw).equals(encoded); }
    }

    @BeforeEach
    public void setUp() {
        TenantContext.set(1L);
        repo = new InMemoryUserRepository();
        userService = new UserService(repo, new FakeEncoder(), new QuotaService(null));
        controller = new UserController(userService);

        cashier = user(30L, "cashier1", Role.CASHIER, "enc:oldpass");
        supervisor = user(20L, "supervisor1", Role.SUPERVISOR, "enc:supervisorpass");
    }

    @AfterEach
    public void tearDown() {
        TenantContext.clear();
    }

    private User user(Long id, String username, Role role, String passwordHash) {
        User u = new User();
        u.setId(id);
        u.setTenantId(1L);
        u.setUsername(username);
        u.setPasswordHash(passwordHash);
        u.setFullName(username);
        u.setRole(role);
        u.setActive(true);
        repo.save(u);
        return u;
    }

    @Test
    public void aCashierCanChangeTheirOwnPassword() {
        controller.changeOwnPassword(new SelfPasswordRequest("oldpass", "brandnew1"),
                new UserPrincipal(cashier));

        assertEquals("enc:brandnew1", repo.findById(30L).orElseThrow().getPasswordHash());
    }

    @Test
    public void aSupervisorCanChangeTheirOwnPassword() {
        // The admin reset endpoint refused this: its target check permits cashiers only.
        controller.changeOwnPassword(new SelfPasswordRequest("supervisorpass", "newsuper1"),
                new UserPrincipal(supervisor));

        assertEquals("enc:newsuper1", repo.findById(20L).orElseThrow().getPasswordHash());
    }

    @Test
    public void theWrongCurrentPasswordIsRefusedAndChangesNothing() {
        ResponseStatusException ex = assertThrows(ResponseStatusException.class, () ->
                controller.changeOwnPassword(new SelfPasswordRequest("not-my-password", "brandnew1"),
                        new UserPrincipal(cashier)));

        assertEquals(HttpStatus.FORBIDDEN, ex.getStatusCode());
        assertEquals("enc:oldpass", repo.findById(30L).orElseThrow().getPasswordHash(),
                "a refused attempt must leave the credential untouched");
    }

    @Test
    public void anAbsentCurrentPasswordIsRefused() {
        assertThrows(ResponseStatusException.class, () ->
                controller.changeOwnPassword(new SelfPasswordRequest(null, "brandnew1"),
                        new UserPrincipal(cashier)));
    }

    @Test
    public void theAccountChangedIsTheOneInTheTokenNotOneNamedByTheCaller() {
        // There is no id parameter to tamper with: a cashier's own password proves only their
        // own account, so this can never reach the supervisor's record.
        controller.changeOwnPassword(new SelfPasswordRequest("oldpass", "brandnew1"),
                new UserPrincipal(cashier));

        assertEquals("enc:supervisorpass", repo.findById(20L).orElseThrow().getPasswordHash());
    }

    @Test
    public void settingOwnPinRequiresTheAccountPassword() {
        ResponseStatusException ex = assertThrows(ResponseStatusException.class, () ->
                controller.changeOwnPin(new SelfPinRequest("wrong", "4321"), new UserPrincipal(cashier)));

        assertEquals(HttpStatus.FORBIDDEN, ex.getStatusCode());
        assertNull(repo.findById(30L).orElseThrow().getPinHash());
    }

    @Test
    public void aCorrectPasswordSetsThePin() {
        controller.changeOwnPin(new SelfPinRequest("oldpass", "4321"), new UserPrincipal(cashier));

        assertEquals("enc:4321", repo.findById(30L).orElseThrow().getPinHash());
    }

    @Test
    public void aPinAlreadyTakenInTheSameTenantIsRejected() {
        controller.changeOwnPin(new SelfPinRequest("oldpass", "4321"), new UserPrincipal(cashier));

        assertThrows(ResponseStatusException.class, () ->
                controller.changeOwnPin(new SelfPinRequest("supervisorpass", "4321"),
                        new UserPrincipal(supervisor)),
                "two people sharing a quick-login PIN makes the audit trail meaningless");
    }
}
