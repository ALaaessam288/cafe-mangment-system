package com.caffio.cafetable.repository;

import com.caffio.cafetable.entity.CafeTable;
import org.springframework.data.jpa.repository.JpaRepository;

public interface CafeTableRepository extends JpaRepository<CafeTable, Long> {

    boolean existsByNumber(Integer number);
}