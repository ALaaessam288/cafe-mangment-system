package com.example.cafemangmentsystem.employee.repository;

import com.example.cafemangmentsystem.employee.entity.Employee;
import org.springframework.data.jpa.repository.JpaRepository;

public interface EmployeeRepository extends JpaRepository<Employee, Long> {
}