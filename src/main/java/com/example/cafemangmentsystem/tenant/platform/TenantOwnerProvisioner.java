package com.example.cafemangmentsystem.tenant.platform;

import com.example.cafemangmentsystem.register.entity.Register;
import com.example.cafemangmentsystem.register.repository.RegisterRepository;
import com.example.cafemangmentsystem.user.entity.Role;
import com.example.cafemangmentsystem.user.entity.User;
import com.example.cafemangmentsystem.user.repository.UserRepository;
import com.example.cafemangmentsystem.cafetable.entity.CafeTable;
import com.example.cafemangmentsystem.cafetable.repository.CafeTableRepository;
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
    private final RegisterRepository registerRepository;
    private final CafeTableRepository cafeTableRepository;

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public User createOwner(String username, String fullName, String rawPassword, Integer defaultTables) {
        User owner = new User();
        owner.setUsername(username);
        owner.setFullName(fullName);
        owner.setPasswordHash(passwordEncoder.encode(rawPassword));
        owner.setRole(Role.ADMIN);
        userRepository.save(owner);

        // Seed default cash register for this tenant
        Register register = new Register();
        register.setName("الدرج الرئيسي");
        registerRepository.save(register);
        
        int tablesToCreate = defaultTables != null ? defaultTables : 5;
        for (int i = 1; i <= tablesToCreate; i++) {
            CafeTable table = new CafeTable();
            table.setNumber(i);
            table.setZone(com.example.cafemangmentsystem.cafetable.entity.TableZone.INDOOR);
            table.setSeats(4);
            cafeTableRepository.save(table);
        }
        
        return owner;
    }
}
