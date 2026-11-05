package com.caffio.ledger.controller;

import com.caffio.ledger.FinancialLedgerService;
import com.caffio.ledger.dto.CashFlowReportResponse;
import com.caffio.ledger.dto.PnLReportResponse;
import com.caffio.ledger.entity.FinancialLedgerEntry;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;

@RestController
@RequestMapping("/api/ledger")
@RequiredArgsConstructor
public class FinancialLedgerController {

    private final FinancialLedgerService ledgerService;

    @GetMapping("/pnl")
    @PreAuthorize("hasAnyRole('ADMIN', 'SUPERVISOR')")
    public PnLReportResponse getPnL(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) Instant start,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) Instant end) {
        Instant effectiveStart = start != null ? start : Instant.now().minus(30, ChronoUnit.DAYS);
        Instant effectiveEnd = end != null ? end : Instant.now();
        return ledgerService.getPnLReport(effectiveStart, effectiveEnd);
    }

    @GetMapping("/cash-flow")
    @PreAuthorize("hasAnyRole('ADMIN', 'SUPERVISOR')")
    public CashFlowReportResponse getCashFlow(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) Instant start,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) Instant end) {
        Instant effectiveStart = start != null ? start : Instant.now().minus(30, ChronoUnit.DAYS);
        Instant effectiveEnd = end != null ? end : Instant.now();
        return ledgerService.getCashFlowReport(effectiveStart, effectiveEnd);
    }

    @GetMapping("/entries")
    @PreAuthorize("hasAnyRole('ADMIN', 'SUPERVISOR')")
    public List<FinancialLedgerEntry> listEntries(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) Instant start,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) Instant end) {
        Instant effectiveStart = start != null ? start : Instant.now().minus(7, ChronoUnit.DAYS);
        Instant effectiveEnd = end != null ? end : Instant.now();
        return ledgerService.listEntries(effectiveStart, effectiveEnd);
    }
}
