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

        EmployeeTransaction transaction = new EmployeeTransaction();
        transaction.setEmployee(employee);
        transaction.setType(request.type());
        transaction.setAmount(request.amount());
        transaction.setNotes(request.notes());
        transaction.setTransactionDate(txDate);
        transaction.setSettled(false);
        transaction.setPaidFromDrawer(Boolean.TRUE.equals(request.paidFromDrawer()));

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
                .filter(e -> e.isActive())
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

            for (EmployeeTransaction tx : txs) {
                if (tx.getType() == EmployeeTransactionType.DEDUCTION) {
                    deductions = deductions.add(tx.getAmount());
                } else if (tx.getType() == EmployeeTransactionType.ADVANCE) {
                    advances = advances.add(tx.getAmount());
                } else if (tx.getType() == EmployeeTransactionType.BONUS) {
                    bonuses = bonuses.add(tx.getAmount());
                    if (!tx.isPaidFromDrawer()) {
                        unpaidBonuses = unpaidBonuses.add(tx.getAmount());
                    }
                }
            }

            BigDecimal base = emp.getBaseSalary() != null ? emp.getBaseSalary() : BigDecimal.ZERO;
            // Net = Base + unpaidBonuses - deductions - advances
            // (Bonuses that were paid immediately from the drawer were already pocketed, so adding
            // them here too would pay them twice.)
            BigDecimal net = base.add(unpaidBonuses).subtract(deductions).subtract(advances);

            List<EmployeeTransactionDto> dtoList = txs.stream()
                    .map(EmployeeTransactionDto::from)
                    .toList();

            boolean isSettled = txs.stream().anyMatch(t -> t.getType() == EmployeeTransactionType.SALARY_PAYOUT);

            summaries.add(new WeeklyPayrollSummaryDto(
                    emp.getId(),
                    emp.getName(),
                    emp.getJobTitle(),
                    base,
                    deductions,
                    advances,
                    bonuses,
                    net,
                    isSettled,
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

        EmployeeTransaction payout = new EmployeeTransaction();
        payout.setEmployee(employee);
        payout.setType(EmployeeTransactionType.SALARY_PAYOUT);
        payout.setAmount(amount);
        payout.setNotes("تسديد الرواتب والقبض الأسبوعي");
        payout.setTransactionDate(payoutDate);
        payout.setSettled(true);
        payout.setPaidFromDrawer(paidFromDrawer);

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
