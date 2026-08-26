package com.example.cafemangmentsystem.employee;

import com.example.cafemangmentsystem.employee.dto.EmployeeTransactionDto;
import com.example.cafemangmentsystem.employee.dto.EmployeeTransactionRequest;
import com.example.cafemangmentsystem.employee.dto.WeeklyPayrollSummaryDto;
import com.example.cafemangmentsystem.employee.entity.Employee;
import com.example.cafemangmentsystem.employee.entity.EmployeeTransaction;
import com.example.cafemangmentsystem.employee.entity.EmployeeTransactionType;
import com.example.cafemangmentsystem.employee.repository.EmployeeRepository;
import com.example.cafemangmentsystem.employee.repository.EmployeeTransactionRepository;
import com.example.cafemangmentsystem.expense.ExpenseService;
import com.example.cafemangmentsystem.expense.dto.ExpenseRequest;
import com.example.cafemangmentsystem.expense.entity.ExpenseType;
import com.example.cafemangmentsystem.menu.entity.RevenueLine;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

@Service
@RequiredArgsConstructor
public class EmployeePayrollService {

    private final EmployeeRepository employeeRepository;
    private final EmployeeTransactionRepository transactionRepository;
    private final ExpenseService expenseService;

    @Transactional
    public EmployeeTransactionDto createTransaction(Long userId, EmployeeTransactionRequest request) {
        Employee employee = employeeRepository.findById(request.employeeId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Employee not found"));

        LocalDate txDate = request.transactionDate() != null ? request.transactionDate() : LocalDate.now();

        EmployeeTransaction transaction = EmployeeTransaction.builder()
                .employee(employee)
                .type(request.type())
                .amount(request.amount())
                .notes(request.notes())
                .transactionDate(txDate)
                .settled(false)
                .paidFromDrawer(Boolean.TRUE.equals(request.paidFromDrawer()))
                .build();

        EmployeeTransaction saved = transactionRepository.save(transaction);

        // Advances are cash the employee already received regardless of funding source, so
        // they must hit the P&L now rather than wait to be netted out of a later payout.
        // Bonuses are only expensed here when paid immediately from the drawer; a bonus
        // recorded without that flag is an accrual that's settled exactly once, when it's
        // folded into the weekly payout (see getWeeklyPayrollSummary/payWeeklySalary) -
        // expensing it here too would double-count it.
        boolean expenseNow = request.type() == EmployeeTransactionType.ADVANCE
                || (request.type() == EmployeeTransactionType.BONUS && Boolean.TRUE.equals(request.paidFromDrawer()));
        if (expenseNow) {
            expenseService.create(userId, new ExpenseRequest(
                    ExpenseType.SALARIES,
                    RevenueLine.SHARED,
                    request.amount(),
                    txDate,
                    false,
                    Boolean.TRUE.equals(request.paidFromDrawer()),
                    employee.getId(),
                    request.notes()
            ));
        }

        return EmployeeTransactionDto.from(saved);
    }

    @Transactional(readOnly = true)
    public List<EmployeeTransactionDto> getEmployeeTransactions(Long employeeId) {
        return transactionRepository.findByEmployeeIdOrderByTransactionDateDescIdDesc(employeeId)
                .stream()
                .map(EmployeeTransactionDto::from)
                .toList();
    }

    @Transactional
    public void deleteTransaction(Long id) {
        EmployeeTransaction transaction = transactionRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Transaction not found"));
        transactionRepository.delete(transaction);
    }

    @Transactional(readOnly = true)
    public List<WeeklyPayrollSummaryDto> getWeeklyPayrollSummary(LocalDate startDate, LocalDate endDate) {
        List<Employee> activeEmployees = employeeRepository.findAll().stream()
                .filter(Employee::isActive)
                .toList();

        List<WeeklyPayrollSummaryDto> summaries = new ArrayList<>();

        for (Employee emp : activeEmployees) {
            List<EmployeeTransaction> txs = transactionRepository.findByEmployeeIdAndTransactionDateBetween(
                    emp.getId(), startDate, endDate
            );

            BigDecimal deductions = BigDecimal.ZERO;
            BigDecimal advances = BigDecimal.ZERO;
            BigDecimal bonuses = BigDecimal.ZERO;
            // Bonuses already paid from the drawer were expensed immediately in
            // createTransaction() - only the still-unpaid ones remain owed at payout time.
            BigDecimal unpaidBonuses = BigDecimal.ZERO;
            boolean hasPayout = false;

            List<EmployeeTransactionDto> dtoList = new ArrayList<>();

            for (EmployeeTransaction t : txs) {
                dtoList.add(EmployeeTransactionDto.from(t));
                if (t.getType() == EmployeeTransactionType.DEDUCTION) {
                    deductions = deductions.add(t.getAmount());
                } else if (t.getType() == EmployeeTransactionType.ADVANCE) {
                    advances = advances.add(t.getAmount());
                } else if (t.getType() == EmployeeTransactionType.BONUS) {
                    bonuses = bonuses.add(t.getAmount());
                    if (!t.isPaidFromDrawer()) {
                        unpaidBonuses = unpaidBonuses.add(t.getAmount());
                    }
                } else if (t.getType() == EmployeeTransactionType.SALARY_PAYOUT) {
                    hasPayout = true;
                }
            }

            long days = java.time.temporal.ChronoUnit.DAYS.between(startDate, endDate) + 1;
            if (days <= 0) days = 1;
            BigDecimal baseWeekly = BigDecimal.ZERO;
            BigDecimal rate = emp.getBaseSalary() != null ? emp.getBaseSalary() : BigDecimal.ZERO;
            String period = emp.getSalaryPeriod() != null ? emp.getSalaryPeriod() : "WEEKLY";

            if ("DAILY".equals(period)) {
                baseWeekly = rate.multiply(BigDecimal.valueOf(days));
            } else if ("WEEKLY".equals(period)) {
                baseWeekly = rate.multiply(BigDecimal.valueOf(days)).divide(BigDecimal.valueOf(7), 2, java.math.RoundingMode.HALF_UP);
            } else if ("MONTHLY".equals(period)) {
                baseWeekly = rate.multiply(BigDecimal.valueOf(days)).divide(BigDecimal.valueOf(30), 2, java.math.RoundingMode.HALF_UP);
            }

            BigDecimal netPayable = baseWeekly.add(unpaidBonuses).subtract(deductions).subtract(advances);
            if (netPayable.compareTo(BigDecimal.ZERO) < 0) {
                netPayable = BigDecimal.ZERO;
            }

            summaries.add(new WeeklyPayrollSummaryDto(
                    emp.getId(),
                    emp.getName(),
                    emp.getJobTitle(),
                    baseWeekly,
                    deductions,
                    advances,
                    bonuses,
                    netPayable,
                    hasPayout,
                    dtoList
            ));
        }

        return summaries;
    }

    @Transactional
    public EmployeeTransactionDto payWeeklySalary(Long userId, Long employeeId, BigDecimal amount, LocalDate date, boolean paidFromDrawer) {
        Employee employee = employeeRepository.findById(employeeId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Employee not found"));

        LocalDate payoutDate = date != null ? date : LocalDate.now();

        EmployeeTransaction payout = EmployeeTransaction.builder()
                .employee(employee)
                .type(EmployeeTransactionType.SALARY_PAYOUT)
                .amount(amount)
                .notes("تسديد الرواتب والقبض الأسبوعي")
                .transactionDate(payoutDate)
                .settled(true)
                .paidFromDrawer(paidFromDrawer)
                .build();

        EmployeeTransaction saved = transactionRepository.save(payout);

        // Always record the payout as a wage expense - regardless of drawer funding - so
        // it reaches the financial report's netProfit. paidFromDrawer only controls whether
        // it's also tied to the cashier's open shift for drawer reconciliation.
        if (amount != null && amount.compareTo(BigDecimal.ZERO) > 0) {
            expenseService.create(userId, new ExpenseRequest(
                    ExpenseType.SALARIES,
                    RevenueLine.SHARED,
                    amount,
                    payoutDate,
                    false,
                    paidFromDrawer,
                    employee.getId(),
                    "تسديد الرواتب والقبض الأسبوعي"
            ));
        }

        return EmployeeTransactionDto.from(saved);
    }

    @Transactional
    public java.util.Map<String, Object> resetWeek(LocalDate upToDate) {
        LocalDate limit = upToDate != null ? upToDate : LocalDate.now();
        List<EmployeeTransaction> unsettled = transactionRepository.findBySettledFalseAndTransactionDateLessThanEqual(limit);
        for (EmployeeTransaction tx : unsettled) {
            tx.setSettled(true);
        }
        transactionRepository.saveAll(unsettled);
        return java.util.Map.of("settledCount", unsettled.size(), "resetDate", limit.toString());
    }
}
