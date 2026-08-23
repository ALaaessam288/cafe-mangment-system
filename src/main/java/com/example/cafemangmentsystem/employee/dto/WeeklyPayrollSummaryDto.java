package com.example.cafemangmentsystem.employee.dto;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

public record WeeklyPayrollSummaryDto(
        Long employeeId,
        String employeeName,
        String jobTitle,
        BigDecimal baseWeeklySalary,
        BigDecimal totalDeductions,
        BigDecimal totalAdvances,
        BigDecimal totalBonuses,
        BigDecimal netPayable,
        boolean isSettled,
        List<EmployeeTransactionDto> transactions
) {
}
