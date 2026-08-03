package com.example.cafemangmentsystem.report;

import com.example.cafemangmentsystem.report.dto.FinancialReportDto;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/reports")
@RequiredArgsConstructor
public class ReportController {

    private final ReportService reportService;

    @GetMapping("/financial")
    @PreAuthorize("hasRole('ADMIN')")
    public FinancialReportDto getComprehensiveFinancialReport() {
        return reportService.getComprehensiveFinancialReport();
    }
}
