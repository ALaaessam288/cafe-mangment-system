package com.example.cafemangmentsystem.printing.entity;

import com.example.cafemangmentsystem.common.entity.TenantScopedEntity;
import com.example.cafemangmentsystem.order.entity.Order;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;

@Entity
@Table(name = "print_jobs", uniqueConstraints = @UniqueConstraint(columnNames = {"tenant_id", "idempotency_key"}))
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class PrintJob extends TenantScopedEntity {

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "order_id", nullable = false)
    private Order order;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "printer_id", nullable = false)
    private Printer printer;

    @Enumerated(EnumType.STRING)
    @Column(name = "ticket_type", nullable = false)
    private TicketType ticketType;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    @Builder.Default
    private PrintJobStatus status = PrintJobStatus.PENDING;

    @Column(columnDefinition = "TEXT", nullable = false)
    private String payload;

    @Column(nullable = false)
    @Builder.Default
    private Integer attempts = 0;

    @Column(name = "last_error")
    private String lastError;

    @Column(name = "idempotency_key", nullable = false)
    private String idempotencyKey;

    @Column(name = "printed_at")
    private Instant printedAt;
}