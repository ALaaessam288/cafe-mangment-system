package com.example.cafemangmentsystem.ledger.repository;

import com.example.cafemangmentsystem.ledger.entity.FinancialAccount;
import com.example.cafemangmentsystem.ledger.entity.FinancialLedgerEntry;
import com.example.cafemangmentsystem.ledger.entity.FinancialLedgerEntryType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

public interface FinancialLedgerRepository extends JpaRepository<FinancialLedgerEntry, Long> {

    List<FinancialLedgerEntry> findAllByOccurredAtBetweenOrderByOccurredAtDesc(Instant start, Instant end);

    List<FinancialLedgerEntry> findAllByShiftIdOrderByOccurredAtDesc(Long shiftId);

    @Query("SELECT COALESCE(SUM(e.amount), 0) FROM FinancialLedgerEntry e WHERE e.entryType = :entryType AND e.occurredAt BETWEEN :start AND :end")
    BigDecimal sumAmountByEntryTypeAndDateBetween(@Param("entryType") FinancialLedgerEntryType entryType, @Param("start") Instant start, @Param("end") Instant end);

    @Query("SELECT COALESCE(SUM(e.amount), 0) FROM FinancialLedgerEntry e WHERE e.debitAccount = :account AND e.occurredAt BETWEEN :start AND :end")
    BigDecimal sumDebitsByAccountAndDateBetween(@Param("account") FinancialAccount account, @Param("start") Instant start, @Param("end") Instant end);

    @Query("SELECT COALESCE(SUM(e.amount), 0) FROM FinancialLedgerEntry e WHERE e.creditAccount = :account AND e.occurredAt BETWEEN :start AND :end")
    BigDecimal sumCreditsByAccountAndDateBetween(@Param("account") FinancialAccount account, @Param("start") Instant start, @Param("end") Instant end);
}
