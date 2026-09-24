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

        /* A deduction must say why.
         *
         * It is the one transaction here that takes money out of someone's wage, and the person
         * it is taken from is not in the room when it is recorded. An unexplained deduction is
         * unanswerable a week later - nobody can confirm it, correct it, or defend it - and it
         * is the line the shift report reads out to the owner on WhatsApp by name and amount.
         * Advances and bonuses are not gated: the employee was standing there for both.
         *
         * Enforced here rather than only in the form, because the form is not the only caller and
         * a rule that lives in a screen is a rule that an API call walks straight past. */
        if (request.type() == EmployeeTransactionType.DEDUCTION
                && (request.notes() == null || request.notes().isBlank())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "لازم تكتب سبب الخصم.");
        }

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

    /**
     * Each employee's own current pay period, not one window for everybody.
     *
     * <p>This used to take a start and an end date from the caller and apply them to all staff,
     * then hand every one of them their full {@code baseSalary} regardless of how wide that window
     * was. A monthly employee shown in a seven-day view was reported as owed a whole month for the
     * week. {@code salaryPeriod} was stored on the employee and consulted by nothing.
     *
     * <p>Now the period comes from the employee: their anchor date plus their cycle. A daily
     * employee's period is today, a weekly employee's is their seven days, a monthly employee's is
     * their month - all on screen together, each correct. {@code baseSalary} is the wage FOR that
     * cycle, which is how it is already entered, so no pro-rating is invented here.
     *
     * @param on the day to report for; periods are the ones containing it. Defaults to today.
     */
    @Transactional(readOnly = true)
    public List<WeeklyPayrollSummaryDto> getPayrollSummary(LocalDate on) {
        LocalDate asOf = on != null ? on : LocalDate.now();

        List<Employee> activeEmployees = employeeRepository.findAll().stream()
                .filter(Employee::isActive)
                .toList();

        List<WeeklyPayrollSummaryDto> summaries = new ArrayList<>();

        for (Employee emp : activeEmployees) {
            LocalDate anchor = emp.getPayrollAnchorDate() != null ? emp.getPayrollAnchorDate() : asOf;
            PayrollPeriod period = PayrollPeriod.of(emp.getSalaryPeriod(), anchor, asOf);

            List<EmployeeTransaction> txs = transactionRepository.findByEmployeeIdAndTransactionDateBetween(
                    emp.getId(), period.start(), period.end()
            );

            BigDecimal deductions = BigDecimal.ZERO;
            BigDecimal advances = BigDecimal.ZERO;
            BigDecimal bonuses = BigDecimal.ZERO;
            // Bonuses already paid from the drawer were expensed immediately in
            // createTransaction() - only the still-unpaid ones remain owed at payout time.
            BigDecimal unpaidBonuses = BigDecimal.ZERO;
            boolean paidThisPeriod = false;

            for (EmployeeTransaction tx : txs) {
                switch (tx.getType()) {
                    case DEDUCTION -> deductions = deductions.add(tx.getAmount());
                    case ADVANCE -> advances = advances.add(tx.getAmount());
                    case BONUS -> {
                        bonuses = bonuses.add(tx.getAmount());
                        if (!tx.isPaidFromDrawer()) unpaidBonuses = unpaidBonuses.add(tx.getAmount());
                    }
                    // Settled means paid WITHIN THIS PERIOD. The old test was "is there a payout
                    // anywhere in the caller's date range", so last week's payout marked this week
                    // settled and the row went green while the wage was still owed.
                    case SALARY_PAYOUT -> paidThisPeriod = true;
                    default -> { }
                }
            }

            BigDecimal base = emp.getBaseSalary() != null ? emp.getBaseSalary() : BigDecimal.ZERO;
            // Net = Base + unpaidBonuses - deductions - advances
            // (Bonuses that were paid immediately from the drawer were already pocketed, so adding
            // them here too would pay them twice.)
            BigDecimal net = base.add(unpaidBonuses).subtract(deductions).subtract(advances);

            summaries.add(new WeeklyPayrollSummaryDto(
                    emp.getId(),
                    emp.getName(),
                    emp.getJobTitle(),
                    base,
                    deductions,
                    advances,
                    bonuses,
                    net,
                    paidThisPeriod,
                    emp.getSalaryPeriod(),
                    period.start(),
                    period.end(),
                    txs.stream().map(EmployeeTransactionDto::from).toList()
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

    /* resetWeek() was here.
     *
     * It set settled = true on every unsettled transaction up to a date and recorded no payment at
     * all, so pressing it before paying made the advances and deductions owed disappear from the
     * next summary with nothing to show they had ever been owed. It existed because periods were
     * not computed and something had to draw a line manually.
     *
     * Periods are computed now, from each employee's anchor date, so there is no line to draw and
     * nothing that could be drawn at the wrong moment. A payout is recorded by payWeeklySalary and
     * is what marks a period settled - by being dated inside it, which is a fact rather than a
     * flag someone can set by accident.
     */
}