package com.example.cafemangmentsystem.security.refresh.repository;

import com.example.cafemangmentsystem.security.refresh.entity.RefreshToken;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface RefreshTokenRepository extends JpaRepository<RefreshToken, Long> {

    Optional<RefreshToken> findByTokenHash(String tokenHash);

    List<RefreshToken> findAllByUserIdAndRevokedFalse(Long userId);
}