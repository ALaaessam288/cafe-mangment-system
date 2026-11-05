package com.caffio.report;

import com.caffio.billing.RequiresFeature;
import com.caffio.billing.entity.Feature;
import com.caffio.report.dto.BestSellerDto;
import com.caffio.report.dto.FinancialReportDto;
import com.caffio.report.dto.HourlySlotDto;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import java.util.List;

@RequiresFeature(Feature.REPORTS)
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
            @RequestParam(name = "shiftId", required = false) Long shiftId,
            @RequestParam(name = "limit", defaultValue = "15") int limit) {
        return reportService.getBestSellers(startDate, endDate, shiftId, Math.min(limit, 50));
    }

    @GetMapping("/hourly")
    @PreAuthorize("hasAnyRole('ADMIN','SUPERVISOR')")
    public List<HourlySlotDto> getHourlySales(
            @RequestParam(name = "startDate", required = false) String startDate,
            @RequestParam(name = "endDate", required = false) String endDate,
            @RequestParam(name = "shiftId", required = false) Long shiftId) {
        return reportService.getHourlySales(startDate, endDate, shiftId);
    }

    @GetMapping("/recipe-profitability")
    @PreAuthorize("hasAnyRole('ADMIN','SUPERVISOR')")
    public com.caffio.report.dto.RecipeProfitabilityDto getRecipeProfitability(
            @RequestParam(required = false) String startDate,
            @RequestParam(required = false) String endDate,
            @RequestParam(required = false) Long shiftId) {
        return reportService.getRecipeProfitability(startDate, endDate, shiftId);
    }
}
