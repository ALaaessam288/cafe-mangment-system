package com.example.cafemangmentsystem.employee.dto;

import com.example.cafemangmentsystem.employee.entity.EmployeeTransaction;
import com.example.cafemangmentsystem.employee.entity.EmployeeTransactionType;

import java.math.BigDecimal;
import java.time.LocalDate;

public record EmployeeTransactionDto(
        Long id,
        Long employeeId,
        String employeeName,
        EmployeeTransactionType type,
        BigDecimal amount,
        String notes,
        LocalDate transactionDate,
        boolean settled,
        boolean paidFromDrawer
) {
    public static EmployeeTransactionDto from(EmployeeTransaction t) {
        return new EmployeeTransactionDto(
                t.getId(),
                t.getEmployee().getId(),
                t.getEmployee().getName(),
                t.getType(),
                t.getAmount(),
                t.getNotes(),
                t.getTransactionDate(),
                t.isSettled(),
                t.isPaidFromDrawer()
        );
    }
}
