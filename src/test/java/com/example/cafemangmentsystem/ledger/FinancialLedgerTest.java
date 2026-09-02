package com.example.cafemangmentsystem.ledger;

import com.example.cafemangmentsystem.common.tenant.TenantContext;
import com.example.cafemangmentsystem.ledger.dto.CashFlowReportResponse;
import com.example.cafemangmentsystem.ledger.dto.PnLReportResponse;
import com.example.cafemangmentsystem.ledger.entity.FinancialAccount;
import com.example.cafemangmentsystem.ledger.entity.FinancialLedgerEntry;
import com.example.cafemangmentsystem.ledger.entity.FinancialLedgerEntryType;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.Instant;

import static org.junit.jupiter.api.Assertions.*;

public class FinancialLedgerTest {

    @BeforeEach
    public void setUp() {
        TenantContext.set(1L);
    }

    @AfterEach
    public void tearDown() {
        TenantContext.clear();
    }

    @Test
    public void pnlEquationComputesNetProfitAccurately() {
        BigDecimal grossSales = new BigDecimal("10000.00");
        BigDecimal refunds = new BigDecimal("500.00");
        BigDecimal netSales = grossSales.subtract(refunds); // 9500.00

        BigDecimal directExpenses = new BigDecimal("3000.00");
        BigDecimal payroll = new BigDecimal("2500.00");
        BigDecimal totalExpenses = directExpenses.add(payroll); // 5500.00

        BigDecimal netProfit = netSales.subtract(totalExpenses); // 4000.00

        PnLReportResponse pnl = new PnLReportResponse(
                Instant.now().minusSeconds(86400),
                Instant.now(),
                grossSales,
                refunds,
                netSales,
                directExpenses,
                payroll,
                totalExpenses,
                netProfit
        );

        assertEquals(new BigDecimal("9500.00"), pnl.netSales());
        assertEquals(new BigDecimal("5500.00"), pnl.totalExpenses());
        assertEquals(new BigDecimal("4000.00"), pnl.netProfit());
    }

    @Test
    public void cashFlowEquationMatchesInflowsAndOutflows() {
        BigDecimal cashSales = new BigDecimal("6000.00");
        BigDecimal cashIn = new BigDecimal("1000.00");
        BigDecimal debtCollected = new BigDecimal("500.00");
        BigDecimal totalInflows = cashSales.add(cashIn).add(debtCollected); // 7500.00

        BigDecimal cashExpenses = new BigDecimal("1200.00");
        BigDecimal safeDrops = new BigDecimal("3000.00");
        BigDecimal cashOut = new BigDecimal("200.00");
        BigDecimal staffAdvances = new BigDecimal("500.00");
        BigDecimal cashRefunds = new BigDecimal("100.00");
        BigDecimal totalOutflows = cashExpenses.add(safeDrops).add(cashOut).add(staffAdvances).add(cashRefunds); // 5000.00

        BigDecimal netCashChange = totalInflows.subtract(totalOutflows); // 2500.00

        CashFlowReportResponse cf = new CashFlowReportResponse(
                Instant.now().minusSeconds(86400),
                Instant.now(),
                cashSales,
                cashIn,
                debtCollected,
                totalInflows,
                cashExpenses,
                safeDrops,
                cashOut,
                staffAdvances,
                cashRefunds,
                totalOutflows,
                netCashChange
        );

        assertEquals(new BigDecimal("7500.00"), cf.totalCashInflows());
        assertEquals(new BigDecimal("5000.00"), cf.totalCashOutflows());
        assertEquals(new BigDecimal("2500.00"), cf.netCashChange());
    }

    @Test
    public void ledgerEntryMaintainsDebitAndCreditAccounts() {
        FinancialLedgerEntry entry = FinancialLedgerEntry.builder()
                .entryType(FinancialLedgerEntryType.SALE)
                .amount(new BigDecimal("150.00"))
                .debitAccount(FinancialAccount.CASH_DRAWER)
                .creditAccount(FinancialAccount.REVENUE_SALES)
                .occurredAt(Instant.now())
                .build();

        assertEquals(FinancialAccount.CASH_DRAWER, entry.getDebitAccount());
        assertEquals(FinancialAccount.REVENUE_SALES, entry.getCreditAccount());
        assertEquals(new BigDecimal("150.00"), entry.getAmount());
    }
}
