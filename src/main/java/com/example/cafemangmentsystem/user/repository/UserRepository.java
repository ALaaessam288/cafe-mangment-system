package com.example.cafemangmentsystem.user.repository;

import com.example.cafemangmentsystem.user.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;

public interface UserRepository extends JpaRepository<User, Long> {

    Optional<User> findByUsername(String username);

    @Query("SELECT u FROM User u WHERE u.username = :username AND u.tenantId = :tenantId")
    Optional<User> findByTenantIdAndUsername(@Param("tenantId") Long tenantId, @Param("username") String username);
}