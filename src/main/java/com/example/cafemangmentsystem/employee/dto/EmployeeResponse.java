package com.example.cafemangmentsystem.employee.dto;

import com.example.cafemangmentsystem.employee.entity.Employee;

import java.math.BigDecimal;
import java.time.LocalDate;

public record EmployeeResponse(
        Long id,
        String fullName,
        String position,
        String phone,
        BigDecimal dailyWage,
        LocalDate hireDate,
        boolean active
) {
    public static EmployeeResponse from(Employee employee) {
        return new EmployeeResponse(
                employee.getId(),
                employee.getFullName(),
                employee.getPosition(),
                employee.getPhone(),
                employee.getDailyWage(),
                employee.getHireDate(),
                employee.isActive());
    }
}