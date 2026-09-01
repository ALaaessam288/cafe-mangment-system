package com.example.cafemangmentsystem.cashmovement.entity;

import com.example.cafemangmentsystem.common.entity.TenantScopedEntity;
import com.example.cafemangmentsystem.register.entity.Register;
import com.example.cafemangmentsystem.shift.entity.Shift;
import com.example.cafemangmentsystem.user.entity.User;
import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.Instant;

@Entity
@Table(name = "cash_movements")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CashMovement extends TenantScopedEntity {

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "shift_id", nullable = false)
    private Shift shift;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "register_id")
    private Register register;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "performed_by", nullable = false)
    private User performedBy;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private CashMovementType type;

    @Column(nullable = false, precision = 10, scale = 2)
    private BigDecimal amount;

    @Column(length = 500)
    private String reason;

    @Column(name = "receipt_number")
    private String receiptNumber;

    @Column(name = "performed_at", nullable = false)
    private Instant performedAt;
}
