package com.example.cafemangmentsystem.report;

import com.example.cafemangmentsystem.report.dto.BestSellerDto;
import com.example.cafemangmentsystem.report.dto.FinancialReportDto;
import com.example.cafemangmentsystem.report.dto.HourlySlotDto;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import java.util.List;

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

    @GetMapping("/bestsellers")
    @PreAuthorize("hasAnyRole('ADMIN','SUPERVISOR')")
    public List<BestSellerDto> getBestSellers(
            @RequestParam(required = false) String startDate,
            @RequestParam(required = false) String endDate,
            @RequestParam(defaultValue = "15") int limit) {
        return reportService.getBestSellers(startDate, endDate, Math.min(limit, 50));
    }

    @GetMapping("/hourly")
    @PreAuthorize("hasAnyRole('ADMIN','SUPERVISOR')")
    public List<HourlySlotDto> getHourlySales(
            @RequestParam(required = false) String startDate,
            @RequestParam(required = false) String endDate) {
        return reportService.getHourlySales(startDate, endDate);
    }

    @GetMapping("/recipe-profitability")
    @PreAuthorize("hasAnyRole('ADMIN','SUPERVISOR')")
    public com.example.cafemangmentsystem.report.dto.RecipeProfitabilityDto getRecipeProfitability(
            @RequestParam(required = false) String startDate,
            @RequestParam(required = false) String endDate,
            @RequestParam(required = false) Long shiftId) {
        return reportService.getRecipeProfitability(startDate, endDate, shiftId);
    }
}
