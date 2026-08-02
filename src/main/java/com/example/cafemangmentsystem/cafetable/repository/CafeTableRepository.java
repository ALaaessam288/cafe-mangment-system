package com.example.cafemangmentsystem.cafetable.repository;

import com.example.cafemangmentsystem.cafetable.entity.CafeTable;
import org.springframework.data.jpa.repository.JpaRepository;

public interface CafeTableRepository extends JpaRepository<CafeTable, Long> {

    boolean existsByNumber(Integer number);
}