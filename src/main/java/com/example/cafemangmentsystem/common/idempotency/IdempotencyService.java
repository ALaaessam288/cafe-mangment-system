package com.example.cafemangmentsystem.common.idempotency;

import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.Instant;
import java.util.Optional;

/**
 * Idempotency for atomic financial operations (checkout, payments, refunds).
 *
 * <p>Prevents a double charge from a network timeout, a double tap, or an offline queue replaying
 * itself. This used to be a {@code ConcurrentHashMap} on the heap, which protected one process for
 * as long as it stayed up: the guard vanished on every deploy and never applied across two
 * instances — precisely the two moments a retry is most likely. It is now a row, written in the
 * caller's transaction alongside the work it describes.
 */
@Service
@RequiredArgsConstructor
public class IdempotencyService {

    private static final Logger log = LoggerFactory.getLogger(IdempotencyService.class);

    /** How long a repeat counts as the same attempt rather than a new one. */
    static final Duration TTL = Duration.ofHours(24);

    private final IdempotencyRecordRepository repository;
    private final ObjectMapper objectMapper;

    /**
     * The answer this key was already given, or null if it is new.
     *
     * <p>A record that cannot be read back is treated as absent. Replaying a half-understood
     * response would be worse than doing the work again — the caller's own guards (a closed shift,
     * an already-settled bill) are the second line of defence.
     */
    @Transactional(readOnly = true)
    public Object get(String key) {
        if (key == null || key.isBlank()) return null;

        Optional<IdempotencyRecord> found = repository.findByKey(key);
        if (found.isEmpty()) return null;

        IdempotencyRecord record = found.get();
        if (record.getCreatedAtUtc() == null
                || record.getCreatedAtUtc().plus(TTL).isBefore(Instant.now())) {
            return null;
        }

        try {
            return objectMapper.readValue(record.getResponseJson(), Class.forName(record.getResponseType()));
        } catch (Exception e) {
            log.warn("Could not replay idempotent response for key {}: {}", key, e.getMessage());
            return null;
        }
    }

    /**
     * Remembers the answer. Joins the caller's transaction on purpose: if the operation rolls back,
     * the key must roll back with it so the request stays retryable.
     */
    @Transactional
    public void put(String key, Object response) {
        if (key == null || key.isBlank() || response == null) return;

        try {
            IdempotencyRecord record = repository.findByKey(key).orElseGet(IdempotencyRecord::new);
            record.setKey(key);
            record.setResponseType(response.getClass().getName());
            record.setResponseJson(objectMapper.writeValueAsString(response));
            record.setCreatedAtUtc(Instant.now());
            repository.save(record);
        } catch (Exception e) {
            // Failing to remember must never fail the sale that already happened.
            log.warn("Could not store idempotency key {}: {}", key, e.getMessage());
        }
    }

    /**
     * Expired keys are dead weight, not history — the ledger records what happened, this table only
     * de-duplicates retries. Runs in its own transaction so a purge can never roll back a sale.
     */
    @Scheduled(cron = "0 30 3 * * *")
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void purgeExpired() {
        try {
            int removed = repository.deleteExpired(Instant.now().minus(TTL));
            if (removed > 0) log.info("Purged {} expired idempotency keys", removed);
        } catch (RuntimeException e) {
            log.warn("Idempotency purge failed: {}", e.getMessage());
        }
    }
}
