package com.example.cafemangmentsystem.expense.entity;

import com.example.cafemangmentsystem.common.entity.TenantScopedEntity;
import com.example.cafemangmentsystem.employee.entity.Employee;
import com.example.cafemangmentsystem.menu.entity.RevenueLine;
import com.example.cafemangmentsystem.shift.entity.Shift;
import com.example.cafemangmentsystem.user.entity.User;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;

@Entity
@Table(name = "expenses")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Expense extends TenantScopedEntity {

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private ExpenseType type;

    @Enumerated(EnumType.STRING)
    @Column(name = "revenue_line", nullable = false)
    private RevenueLine revenueLine;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false)
    @Builder.Default
    private ExpenseStatus status = ExpenseStatus.COMPLETED;

    @Column(nullable = false, precision = 10, scale = 2)
    private BigDecimal amount;

    @Column(name = "advance_amount", precision = 10, scale = 2)
    private BigDecimal advanceAmount;

    @Column(name = "actual_amount", precision = 10, scale = 2)
    private BigDecimal actualAmount;

    @Column(name = "returned_amount", precision = 10, scale = 2)
    private BigDecimal returnedAmount;

    @Column(name = "is_advance", nullable = false)
    @Builder.Default
    private boolean isAdvance = false;

    @Column(name = "settled_at")
    private Instant settledAt;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "settled_by")
    private User settledBy;

    @Column(name = "notes", columnDefinition = "TEXT")
    private String notes;

    @Column(name = "expense_date", nullable = false)
    private LocalDate expenseDate;

    @Column(name = "is_recurring", nullable = false)
    @Builder.Default
    private boolean recurring = false;

    @Column(name = "paid_from_drawer", nullable = false)
    @Builder.Default
    private boolean paidFromDrawer = false;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "shift_id")
    private Shift shift;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "employee_id")
    private Employee employee;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "recorded_by", nullable = false)
    private User recordedBy;
}