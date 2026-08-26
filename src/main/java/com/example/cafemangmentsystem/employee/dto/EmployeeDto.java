package com.example.cafemangmentsystem.employee.dto;

import com.example.cafemangmentsystem.employee.entity.Employee;
import java.math.BigDecimal;
import java.time.Instant;

public record EmployeeDto(
        Long id,
        String name,
        String jobTitle,
        BigDecimal baseSalary,
        String salaryPeriod,
        boolean active,
        Instant createdAt
) {
    public static EmployeeDto from(Employee e) {
        return new EmployeeDto(
                e.getId(),
                e.getName(),
                e.getJobTitle(),
                e.getBaseSalary(),
                e.getSalaryPeriod(),
                e.isActive(),
                e.getCreatedAt()
        );
    }
}
