package com.example.cafemangmentsystem.common.idempotency;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.HashMap;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * Idempotency has to survive the two moments a client is most likely to retry: a restart, and a
 * request landing on a different instance. The old implementation was a heap map, so it survived
 * neither — a checkout replayed through a deploy charged the customer twice.
 *
 * <p>The shared store below stands in for the table: two service instances reading it is the same
 * situation as two nodes, and building a second instance over the same store is a restart.
 */
class IdempotencyDurabilityTest {

    private Map<String, IdempotencyRecord> store;

    @BeforeEach
    void setUp() {
        store = new HashMap<>();
    }

    /** A fresh service over the shared store — a new process, or a second node. */
    private IdempotencyService newInstance() {
        IdempotencyRecordRepository repository = mock(IdempotencyRecordRepository.class);
        when(repository.findByKey(anyString()))
                .thenAnswer(i -> Optional.ofNullable(store.get(i.<String>getArgument(0))));
        when(repository.save(any(IdempotencyRecord.class))).thenAnswer(i -> {
            IdempotencyRecord r = i.getArgument(0);
            store.put(r.getKey(), r);
            return r;
        });
        return new IdempotencyService(repository, new ObjectMapper());
    }

    @Test
    void anUnseenKeyResolvesToNothing() {
        assertNull(newInstance().get("never-seen"));
    }

    @Test
    void theSameKeyReplaysTheSameAnswer() {
        IdempotencyService service = newInstance();
        service.put("checkout-1", "ORDER-77");

        assertEquals("ORDER-77", service.get("checkout-1"));
        assertEquals("ORDER-77", service.get("checkout-1"), "replay must be stable");
    }

    @Test
    void aKeySurvivesARestart() {
        newInstance().put("checkout-1", "ORDER-77");

        // The process this was stored in is gone.
        assertEquals("ORDER-77", newInstance().get("checkout-1"),
                "a checkout retried through a deploy must not run twice");
    }

    @Test
    void aSecondInstanceSeesTheFirstInstancesKey() {
        IdempotencyService nodeA = newInstance();
        IdempotencyService nodeB = newInstance();

        nodeA.put("checkout-1", "ORDER-77");

        assertEquals("ORDER-77", nodeB.get("checkout-1"),
                "behind a load balancer the retry usually lands on the other node");
    }

    @Test
    void aBlankOrNullKeyIsNeitherStoredNorFound() {
        IdempotencyService service = newInstance();
        service.put(null, "X");
        service.put("   ", "X");

        assertNull(service.get(null));
        assertNull(service.get("   "));
        assertTrue(store.isEmpty());
    }

    @Test
    void aNullResponseIsNotStored() {
        IdempotencyService service = newInstance();
        service.put("checkout-1", null);

        assertTrue(store.isEmpty(), "there is no answer to replay");
    }

    @Test
    void anExpiredKeyIsTreatedAsNew() {
        IdempotencyService service = newInstance();
        service.put("checkout-1", "ORDER-77");

        store.get("checkout-1").setCreatedAtUtc(Instant.now().minus(IdempotencyService.TTL).minusSeconds(60));

        assertNull(service.get("checkout-1"),
                "past the window this is a new attempt, not a repeat of the old one");
    }

    @Test
    void anUnreadableRecordIsTreatedAsAbsentRatherThanReplayed() {
        IdempotencyService service = newInstance();
        service.put("checkout-1", "ORDER-77");
        store.get("checkout-1").setResponseType("com.example.NoSuchClass");

        assertNull(service.get("checkout-1"),
                "replaying a half-understood response is worse than doing the work again");
    }

    @Test
    void storingTheSameKeyTwiceKeepsOneRecord() {
        IdempotencyService service = newInstance();
        service.put("checkout-1", "ORDER-77");
        service.put("checkout-1", "ORDER-88");

        assertEquals(1, store.size(), "a key is unique per tenant");
        assertEquals("ORDER-88", service.get("checkout-1"));
    }
}
