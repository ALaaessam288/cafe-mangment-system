package com.example.cafemangmentsystem.printing.dto;

import com.example.cafemangmentsystem.printing.entity.PrintJob;
import com.example.cafemangmentsystem.printing.entity.PrintJobStatus;
import com.example.cafemangmentsystem.printing.entity.TicketType;

import java.time.Instant;

public record PrintJobResponse(
        Long id,
        Long orderId,
        Long printerId,
        TicketType ticketType,
        PrintJobStatus status,
        String payload,
        Integer attempts,
        String lastError,
        String idempotencyKey,
        Instant createdAt,
        Instant printedAt
) {
    public static PrintJobResponse from(PrintJob job) {
        return new PrintJobResponse(
                job.getId(),
                job.getOrder().getId(),
                job.getPrinter().getId(),
                job.getTicketType(),
                job.getStatus(),
                job.getPayload(),
                job.getAttempts(),
                job.getLastError(),
                job.getIdempotencyKey(),
                job.getCreatedAt(),
                job.getPrintedAt());
    }
}