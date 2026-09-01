package com.example.cafemangmentsystem.manageroverride.entity;

import com.example.cafemangmentsystem.common.entity.TenantScopedEntity;
import com.example.cafemangmentsystem.user.entity.User;
import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.Instant;

@Entity
@Table(name = "manager_overrides")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ManagerOverride extends TenantScopedEntity {

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "supervisor_id", nullable = false)
    private User supervisor;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "cashier_id")
    private User cashier;

    @Enumerated(EnumType.STRING)
    @Column(name = "action_type", nullable = false)
    private ManagerOverrideType actionType;

    @Column(name = "order_id")
    private Long orderId;

    @Column(name = "shift_id")
    private Long shiftId;

    @Column(precision = 10, scale = 2)
    private BigDecimal amount;

    @Column(nullable = false, length = 500)
    private String reason;

    @Column(length = 1000)
    private String details;

    @Column(name = "performed_at", nullable = false)
    private Instant performedAt;
}
