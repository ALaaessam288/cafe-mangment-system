package com.example.cafemangmentsystem.employee;

import com.example.cafemangmentsystem.billing.RequiresFeature;
import com.example.cafemangmentsystem.billing.entity.Feature;
import com.example.cafemangmentsystem.employee.dto.EmployeeTransactionDto;
import com.example.cafemangmentsystem.employee.dto.EmployeeTransactionRequest;
import com.example.cafemangmentsystem.employee.dto.WeeklyPayrollSummaryDto;
import com.example.cafemangmentsystem.security.UserPrincipal;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;

@RequiresFeature(Feature.PAYROLL)
@RestController
@RequestMapping("/api/employees")
@RequiredArgsConstructor
public class  EmployeePayrollController {

    private final EmployeePayrollService payrollService;

    @PostMapping("/transactions")
    @ResponseStatus(HttpStatus.CREATED)
    public EmployeeTransactionDto createTransaction(@AuthenticationPrincipal UserPrincipal principal,
                                                      @Valid @RequestBody EmployeeTransactionRequest request) {
        return payrollService.createTransaction(principal.getId(), request);
    }

    @GetMapping("/{employeeId}/transactions")
    public List<EmployeeTransactionDto> getEmployeeTransactions(@PathVariable Long employeeId) {
        return payrollService.getEmployeeTransactions(employeeId);
    }

    @DeleteMapping("/transactions/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteTransaction(@PathVariable Long id) {
        payrollService.deleteTransaction(id);
    }

    /**
     * The payroll table. One optional {@code on} date; each employee's period is derived from it.
     *
     * <p>startDate/endDate are still accepted so an older frontend does not break, but they no
     * longer define the window - they never could define a correct one for staff on different
     * cycles. startDate, if given, is read as "report as of this day".
     */
    @GetMapping("/payroll/summary")
    @PreAuthorize("hasAnyRole('ADMIN','SUPERVISOR')")
    public List<WeeklyPayrollSummaryDto> getPayrollSummary(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate on,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate startDate) {
        return payrollService.getPayrollSummary(on != null ? on : startDate);
    }

    @PostMapping("/{employeeId}/payroll/payout")
    public EmployeeTransactionDto payWeeklySalary(
            @AuthenticationPrincipal UserPrincipal principal,
            @PathVariable Long employeeId,
            @RequestBody Map<String, Object> body) {
        BigDecimal amount = new BigDecimal(body.get("amount").toString());
        boolean paidFromDrawer = body.get("paidFromDrawer") != null && Boolean.parseBoolean(body.get("paidFromDrawer").toString());
        String dateStr = body.get("date") != null ? body.get("date").toString() : null;
        LocalDate date = dateStr != null ? LocalDate.parse(dateStr) : LocalDate.now();

        return payrollService.payWeeklySalary(principal.getId(), employeeId, amount, date, paidFromDrawer);
    }

    /* The /payroll/reset-week endpoint was removed along with the service method behind it: it
     * settled unpaid transactions without paying them. Pay periods are computed from each
     * employee's anchor date now, so nothing needs resetting. */
}