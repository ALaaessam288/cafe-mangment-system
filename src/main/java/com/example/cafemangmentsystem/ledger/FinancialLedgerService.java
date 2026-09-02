package com.example.cafemangmentsystem.ledger;

import com.example.cafemangmentsystem.ledger.dto.CashFlowReportResponse;
import com.example.cafemangmentsystem.ledger.dto.PnLReportResponse;
import com.example.cafemangmentsystem.ledger.entity.FinancialAccount;
import com.example.cafemangmentsystem.ledger.entity.FinancialLedgerEntry;
import com.example.cafemangmentsystem.ledger.entity.FinancialLedgerEntryType;
import com.example.cafemangmentsystem.ledger.repository.FinancialLedgerRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

@Service
@RequiredArgsConstructor
@Transactional
@Slf4j
public class FinancialLedgerService {

    private final FinancialLedgerRepository ledgerRepository;

    public FinancialLedgerEntry postEntry(FinancialLedgerEntryType type, BigDecimal amount,
                                         FinancialAccount debit, FinancialAccount credit,
                                         String referenceType, Long referenceId,
                                         Long shiftId, Long userId, String notes) {
        if (amount == null || amount.compareTo(BigDecimal.ZERO) <= 0) {
            return null; // Ignore zero or negative post attempts
        }

        FinancialLedgerEntry entry = FinancialLedgerEntry.builder()
                .entryType(type)
                .amount(amount)
                .debitAccount(debit)
                .creditAccount(credit)
                .referenceType(referenceType)
                .referenceId(referenceId)
                .shiftId(shiftId)
                .performedById(userId)
                .occurredAt(Instant.now())
                .notes(notes)
                .build();

        return ledgerRepository.save(entry);
    }

    @Transactional(readOnly = true)
    public PnLReportResponse getPnLReport(Instant start, Instant end) {
        BigDecimal grossSales = ledgerRepository.sumAmountByEntryTypeAndDateBetween(FinancialLedgerEntryType.SALE, start, end);
        BigDecimal refunds = ledgerRepository.sumAmountByEntryTypeAndDateBetween(FinancialLedgerEntryType.REFUND, start, end);
        BigDecimal netSales = grossSales.subtract(refunds);

        BigDecimal directExpenses = ledgerRepository.sumAmountByEntryTypeAndDateBetween(FinancialLedgerEntryType.EXPENSE, start, end);
        BigDecimal payroll = ledgerRepository.sumAmountByEntryTypeAndDateBetween(FinancialLedgerEntryType.PAYROLL_PAYOUT, start, end);
        BigDecimal totalExpenses = directExpenses.add(payroll);

        BigDecimal netProfit = netSales.subtract(totalExpenses);

        return new PnLReportResponse(start, end, grossSales, refunds, netSales, directExpenses, payroll, totalExpenses, netProfit);
    }

    @Transactional(readOnly = true)
    public CashFlowReportResponse getCashFlowReport(Instant start, Instant end) {
        BigDecimal cashSales = ledgerRepository.sumDebitsByAccountAndDateBetween(FinancialAccount.CASH_DRAWER, start, end);
        BigDecimal cashIn = ledgerRepository.sumAmountByEntryTypeAndDateBetween(FinancialLedgerEntryType.CASH_IN, start, end);
        BigDecimal debtCollected = ledgerRepository.sumAmountByEntryTypeAndDateBetween(FinancialLedgerEntryType.DEBT_COLLECTED, start, end);
        BigDecimal totalInflows = cashSales.add(cashIn).add(debtCollected);

        BigDecimal cashExpenses = ledgerRepository.sumAmountByEntryTypeAndDateBetween(FinancialLedgerEntryType.EXPENSE, start, end);
        BigDecimal safeDrops = ledgerRepository.sumAmountByEntryTypeAndDateBetween(FinancialLedgerEntryType.SAFE_DROP, start, end);
        BigDecimal cashOut = ledgerRepository.sumAmountByEntryTypeAndDateBetween(FinancialLedgerEntryType.CASH_OUT, start, end);
        BigDecimal staffAdvances = ledgerRepository.sumAmountByEntryTypeAndDateBetween(FinancialLedgerEntryType.STAFF_ADVANCE, start, end);
        BigDecimal cashRefunds = ledgerRepository.sumAmountByEntryTypeAndDateBetween(FinancialLedgerEntryType.REFUND, start, end);
        BigDecimal totalOutflows = cashExpenses.add(safeDrops).add(cashOut).add(staffAdvances).add(cashRefunds);

        BigDecimal netCashChange = totalInflows.subtract(totalOutflows);

        return new CashFlowReportResponse(start, end, cashSales, cashIn, debtCollected, totalInflows,
                cashExpenses, safeDrops, cashOut, staffAdvances, cashRefunds, totalOutflows, netCashChange);
    }

    @Transactional(readOnly = true)
    public List<FinancialLedgerEntry> listEntries(Instant start, Instant end) {
        return ledgerRepository.findAllByOccurredAtBetweenOrderByOccurredAtDesc(start, end);
    }
}
