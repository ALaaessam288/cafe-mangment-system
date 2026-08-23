package com.example.cafemangmentsystem.report;

import com.example.cafemangmentsystem.report.dto.FinancialReportDto;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/reports")
@RequiredArgsConstructor
public class ReportController {

    private final ReportService reportService;

    @GetMapping("/financial")
    @PreAuthorize("hasAnyRole('ADMIN','SUPERVISOR')")
    public FinancialReportDto getComprehensiveFinancialReport(
            @RequestParam(required = false) String startDate,
            @RequestParam(required = false) String endDate,
            @RequestParam(required = false) Long shiftId) {
        return reportService.getComprehensiveFinancialReport(startDate, endDate, shiftId);
    }
}
