package com.example.cafemangmentsystem.employee;

import com.example.cafemangmentsystem.common.tenant.TenantContext;
import com.example.cafemangmentsystem.debt.entity.Debt;
import com.example.cafemangmentsystem.employee.dto.WeeklyPayrollSummaryDto;
import com.example.cafemangmentsystem.employee.entity.Employee;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

public class PayrollReceivablesPayablesTest {

    @BeforeEach
    public void setUp() {
        TenantContext.set(1L);
    }

    @AfterEach
    public void tearDown() {
        TenantContext.clear();
    }

    @Test
    public void netPayrollCalculatesAccuratelyWithAdvancesAndDeductions() {
        BigDecimal base = new BigDecimal("1200.00");
        BigDecimal advances = new BigDecimal("300.00");
        BigDecimal deductions = new BigDecimal("100.00");
        BigDecimal bonuses = new BigDecimal("150.00");

        // Net = Base + Bonuses - Deductions - Advances
        BigDecimal net = base.add(bonuses).subtract(deductions).subtract(advances); // 950.00
        assertEquals(new BigDecimal("950.00"), net);

        WeeklyPayrollSummaryDto summary = new WeeklyPayrollSummaryDto(
                1L, "أحمد علي", "باريستا",
                base, deductions, advances, bonuses, net, false, List.of()
        );

        assertEquals(new BigDecimal("950.00"), summary.netPayable());
        assertFalse(summary.isSettled());
    }

    @Test
    public void debtPartialSettlementReducesOutstandingBalance() {
        Debt debt = new Debt();
        debt.setCreditorName("شركة البن السريعة");
        debt.setAmount(new BigDecimal("5000.00"));
        debt.setPaidAmount(new BigDecimal("2000.00"));

        BigDecimal remaining = debt.getAmount().subtract(debt.getPaidAmount());
        assertEquals(new BigDecimal("3000.00"), remaining);

        // Make partial payment of 1500
        BigDecimal payment = new BigDecimal("1500.00");
        debt.setPaidAmount(debt.getPaidAmount().add(payment));
        assertEquals(new BigDecimal("3500.00"), debt.getPaidAmount());

        BigDecimal newRemaining = debt.getAmount().subtract(debt.getPaidAmount());
        assertEquals(new BigDecimal("1500.00"), newRemaining);
        assertFalse(debt.isSettled());
    }
}
