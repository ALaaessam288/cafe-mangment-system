package com.example.cafemangmentsystem.common.idempotency;

import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * In-memory idempotency cache for atomic financial operations (Checkout, Payments, Refunds).
 * Prevents double charging on network timeouts, multi-click retries, and offline queue syncing.
 */
@Service
public class IdempotencyService {

    private static final long TTL_SECONDS = 600; // 10 minutes

    private static class Entry {
        final Object response;
        final Instant createdAt;

        Entry(Object response) {
            this.response = response;
            this.createdAt = Instant.now();
        }
    }

    private final Map<String, Entry> cache = new ConcurrentHashMap<>();

    public Object get(String key) {
        if (key == null || key.isBlank()) return null;
        Entry entry = cache.get(key);
        if (entry != null) {
            if (Instant.now().isBefore(entry.createdAt.plusSeconds(TTL_SECONDS))) {
                return entry.response;
            } else {
                cache.remove(key);
            }
        }
        return null;
    }

    public void put(String key, Object response) {
        if (key != null && !key.isBlank() && response != null) {
            cache.put(key, new Entry(response));
        }
    }
}
