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
        /* Which period these figures cover, and on what cycle. The screen used to show numbers
           with no statement of the window they belonged to - and the window was whatever the
           caller happened to pass, the same one for everybody. */
        String salaryPeriod,
        LocalDate periodStart,
        LocalDate periodEnd,
        List<EmployeeTransactionDto> transactions
) {
}
