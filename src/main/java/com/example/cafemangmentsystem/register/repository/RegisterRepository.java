package com.example.cafemangmentsystem.register.repository;

import com.example.cafemangmentsystem.register.entity.Register;
import org.springframework.data.jpa.repository.JpaRepository;

public interface RegisterRepository extends JpaRepository<Register, Long> {
}
