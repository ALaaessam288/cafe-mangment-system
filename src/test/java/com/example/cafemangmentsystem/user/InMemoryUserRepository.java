package com.example.cafemangmentsystem.user;

import com.example.cafemangmentsystem.user.entity.User;
import com.example.cafemangmentsystem.user.repository.UserRepository;

import java.util.*;
import java.util.stream.Collectors;

/**
 * A hand-rolled UserRepository for tests that exercise controller and service logic without a
 * database. Extracted from SecurityAuthorizationTest, where it was a private inner class, so the
 * credential tests can use the same one instead of keeping a second copy in step with the
 * interface.
 */
public class InMemoryUserRepository implements UserRepository {

    private final Map<Long, User> db = new HashMap<>();

    @Override
    public Optional<User> findById(Long id) {
        return Optional.ofNullable(db.get(id));
    }

    @Override
    public List<User> findAllByTenantIdAndUsername(Long tenantId, String username) {
        return db.values().stream()
                .filter(u -> Objects.equals(u.getTenantId(), tenantId) && Objects.equals(u.getUsername(), username))
                .collect(Collectors.toList());
    }

    @Override
    public List<User> findAllByTenantId(Long tenantId) {
        return db.values().stream()
                .filter(u -> Objects.equals(u.getTenantId(), tenantId))
                .collect(Collectors.toList());
    }

    @Override
    public Optional<User> findByUsername(String username) {
        return db.values().stream()
                .filter(u -> Objects.equals(u.getUsername(), username))
                .findFirst();
    }

    @Override
    public <S extends User> S save(S entity) {
        if (entity.getId() == null) {
            entity.setId((long) (db.size() + 1));
        }
        db.put(entity.getId(), entity);
        return entity;
    }

    @Override public long count() { return db.size(); }
    @Override public List<User> findAll() { return new ArrayList<>(db.values()); }
    @Override public boolean existsById(Long aLong) { return db.containsKey(aLong); }
    @Override public void deleteById(Long aLong) { db.remove(aLong); }
    @Override public void delete(User entity) { db.remove(entity.getId()); }
    @Override public void deleteAllById(Iterable<? extends Long> longs) {}
    @Override public void deleteAll(Iterable<? extends User> entities) {}
    @Override public void deleteAll() { db.clear(); }
    @Override public <S extends User> List<S> saveAll(Iterable<S> entities) { return Collections.emptyList(); }
    @Override public List<User> findAllById(Iterable<Long> longs) { return Collections.emptyList(); }
    @Override public void flush() {}
    @Override public <S extends User> S saveAndFlush(S entity) { return save(entity); }
    @Override public <S extends User> List<S> saveAllAndFlush(Iterable<S> entities) { return Collections.emptyList(); }
    @Override public void deleteAllInBatch(Iterable<User> entities) {}
    @Override public void deleteAllByIdInBatch(Iterable<Long> longs) {}
    @Override public void deleteAllInBatch() {}
    @Override public User getOne(Long aLong) { return db.get(aLong); }
    @Override public User getById(Long aLong) { return db.get(aLong); }
    @Override public User getReferenceById(Long aLong) { return db.get(aLong); }
    @Override public <S extends User> Optional<S> findOne(org.springframework.data.domain.Example<S> example) { return Optional.empty(); }
    @Override public <S extends User> List<S> findAll(org.springframework.data.domain.Example<S> example) { return Collections.emptyList(); }
    @Override public <S extends User> List<S> findAll(org.springframework.data.domain.Example<S> example, org.springframework.data.domain.Sort sort) { return Collections.emptyList(); }
    @Override public <S extends User> org.springframework.data.domain.Page<S> findAll(org.springframework.data.domain.Example<S> example, org.springframework.data.domain.Pageable pageable) { return null; }
    @Override public <S extends User> long count(org.springframework.data.domain.Example<S> example) { return 0; }
    @Override public <S extends User> boolean exists(org.springframework.data.domain.Example<S> example) { return false; }
    @Override public <S extends User, R> R findBy(org.springframework.data.domain.Example<S> example, java.util.function.Function<org.springframework.data.repository.query.FluentQuery.FetchableFluentQuery<S>, R> queryFunction) { return null; }
    @Override public List<User> findAll(org.springframework.data.domain.Sort sort) { return Collections.emptyList(); }
    @Override public org.springframework.data.domain.Page<User> findAll(org.springframework.data.domain.Pageable pageable) { return null; }

}
