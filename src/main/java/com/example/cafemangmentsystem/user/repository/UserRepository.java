package com.example.cafemangmentsystem.user.repository;

import com.example.cafemangmentsystem.user.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface UserRepository extends JpaRepository<User, Long> {

    Optional<User> findByUsername(String username);

    @Query("SELECT u FROM User u WHERE u.username = :username AND u.tenantId = :tenantId")
    List<User> findAllByTenantIdAndUsername(@Param("tenantId") Long tenantId, @Param("username") String username);

    @Query("SELECT u FROM User u WHERE u.tenantId = :tenantId")
    List<User> findAllByTenantId(@Param("tenantId") Long tenantId);

    default Optional<User> findByTenantIdAndUsername(Long tenantId, String username) {
        List<User> users = findAllByTenantIdAndUsername(tenantId, username);
        if (users.isEmpty()) return Optional.empty();
        return Optional.of(users.stream().filter(User::isActive).findFirst().orElse(users.get(0)));
    }
}