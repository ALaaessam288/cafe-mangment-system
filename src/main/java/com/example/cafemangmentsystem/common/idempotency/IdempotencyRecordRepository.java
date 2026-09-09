package com.example.cafemangmentsystem.common.idempotency;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.Optional;

@Repository
public interface IdempotencyRecordRepository extends JpaRepository<IdempotencyRecord, Long> {

    Optional<IdempotencyRecord> findByKey(String key);

    @Modifying
    @Query("DELETE FROM IdempotencyRecord r WHERE r.createdAtUtc < :cutoff")
    int deleteExpired(@Param("cutoff") Instant cutoff);
}
