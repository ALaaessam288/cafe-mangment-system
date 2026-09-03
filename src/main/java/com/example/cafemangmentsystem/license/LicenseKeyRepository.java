package com.example.cafemangmentsystem.license;

import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface LicenseKeyRepository extends JpaRepository<LicenseKey, Long> {

    Optional<LicenseKey> findByKey(String key);

    boolean existsByKey(String key);

    List<LicenseKey> findAllByOrderByCreatedAtDesc();

    /**
     * Redemption path. Takes a row lock so two concurrent activations of the same single-use key
     * serialise instead of both passing the redeemability check.
     */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT lk FROM LicenseKey lk WHERE lk.key = :key")
    Optional<LicenseKey> findByKeyForUpdate(@Param("key") String key);
}
