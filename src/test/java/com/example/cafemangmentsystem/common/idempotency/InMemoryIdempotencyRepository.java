package com.example.cafemangmentsystem.common.idempotency;

import java.util.HashMap;
import java.util.Map;
import java.util.Optional;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * A repository that behaves like the table, for tests that care about replay rather than storage.
 *
 * <p>Built as a stubbed mock rather than a hand-written class because {@code JpaRepository} carries
 * far more surface than these tests touch, and implementing all of it would be noise.
 */
public final class InMemoryIdempotencyRepository {

    private InMemoryIdempotencyRepository() {
    }

    public static IdempotencyService service() {
        Map<String, IdempotencyRecord> store = new HashMap<>();
        IdempotencyRecordRepository repository = mock(IdempotencyRecordRepository.class);

        when(repository.findByKey(anyString()))
                .thenAnswer(i -> Optional.ofNullable(store.get(i.<String>getArgument(0))));
        when(repository.save(any(IdempotencyRecord.class))).thenAnswer(i -> {
            IdempotencyRecord record = i.getArgument(0);
            store.put(record.getKey(), record);
            return record;
        });

        return new IdempotencyService(repository, new com.fasterxml.jackson.databind.ObjectMapper());
    }
}
