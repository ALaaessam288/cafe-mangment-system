package com.example.cafemangmentsystem.security;

import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Rate limiting and brute-force protection.
 *
 * <p>Two different jobs, because they defend against different things:
 * <ul>
 *   <li>{@link #checkLockout}/{@link #recordFailure} count <em>failures</em> — the classic
 *       password-guessing defence, where a success is legitimate and resets the counter.</li>
 *   <li>{@link #checkThroughput} counts <em>every</em> attempt, successful ones included. A public
 *       signup endpoint needs this one: each request succeeding is exactly the abuse, and a
 *       failure-only limiter would happily let one client create a thousand tenants.</li>
 * </ul>
 *
 * <p>State is per-instance and in memory. That is honest for a single-node deployment and no
 * defence at all across several; a shared store is the upgrade when the platform scales out.
 */
@Service
public class RateLimiterService {

    private static final int MAX_ATTEMPTS = 5;
    private static final long LOCKOUT_DURATION_SECONDS = 300; // 5 minutes
    private static final long ATTEMPT_WINDOW_SECONDS = 300; // 5 minutes

    private static class AttemptRecord {
        int failedAttempts;
        Instant firstAttemptTime;
        Instant lockedUntil;

        AttemptRecord() {
            this.failedAttempts = 1;
            this.firstAttemptTime = Instant.now();
            this.lockedUntil = null;
        }
    }

    private final Map<String, AttemptRecord> attemptsMap = new ConcurrentHashMap<>();

    /**
     * Checks if the given key is currently locked out.
     * Throws ResponseStatusException with HTTP 429 if locked.
     */
    public void checkLockout(String key) {
        AttemptRecord record = attemptsMap.get(key);
        if (record != null && record.lockedUntil != null) {
            if (Instant.now().isBefore(record.lockedUntil)) {
                long remainingSeconds = java.time.Duration.between(Instant.now(), record.lockedUntil).toSeconds();
                throw new org.springframework.web.server.ResponseStatusException(
                        org.springframework.http.HttpStatus.TOO_MANY_REQUESTS,
                        "تم حظر المحاولات مؤقتاً لكثرة المحاولات الخاطئة. يرجى المحاولة بعد " + Math.max(1, remainingSeconds) + " ثانية."
                );
            } else {
                // Lockout expired, clean up
                attemptsMap.remove(key);
            }
        }
    }

    /**
     * Records a failed attempt for the key. If max attempts reached, locks the key.
     */
    public void recordFailure(String key) {
        Instant now = Instant.now();
        attemptsMap.compute(key, (k, record) -> {
            if (record == null) {
                return new AttemptRecord();
            }
            // Check if window expired
            if (java.time.Duration.between(record.firstAttemptTime, now).toSeconds() > ATTEMPT_WINDOW_SECONDS) {
                record.failedAttempts = 1;
                record.firstAttemptTime = now;
                record.lockedUntil = null;
                return record;
            }
            record.failedAttempts++;
            if (record.failedAttempts >= MAX_ATTEMPTS) {
                record.lockedUntil = now.plusSeconds(LOCKOUT_DURATION_SECONDS);
            }
            return record;
        });
    }

    /**
     * Resets failed attempts for the key on successful action.
     */
    public void reset(String key) {
        attemptsMap.remove(key);
    }

    /**
     * Throughput limit: allows at most {@code maxPerWindow} attempts of any outcome per key within
     * the window, and counts this one. Throws 429 when the allowance is spent.
     *
     * @param key          what to meter on — for an unauthenticated endpoint, the client address
     * @param maxPerWindow how many are allowed
     * @param windowSeconds length of the rolling window
     */
    public void checkThroughput(String key, int maxPerWindow, long windowSeconds) {
        Instant now = Instant.now();
        AttemptRecord record = attemptsMap.compute(key, (k, existing) -> {
            if (existing == null
                    || java.time.Duration.between(existing.firstAttemptTime, now).toSeconds() > windowSeconds) {
                return new AttemptRecord();
            }
            existing.failedAttempts++;
            return existing;
        });

        if (record.failedAttempts > maxPerWindow) {
            long retryAfter = Math.max(1,
                    windowSeconds - java.time.Duration.between(record.firstAttemptTime, now).toSeconds());
            throw new org.springframework.web.server.ResponseStatusException(
                    org.springframework.http.HttpStatus.TOO_MANY_REQUESTS,
                    "عدد كبير من المحاولات. يرجى المحاولة بعد " + retryAfter + " ثانية.");
        }
    }
}
