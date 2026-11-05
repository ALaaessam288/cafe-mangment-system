package com.caffio.printing.dto;

import com.caffio.printing.entity.PrintJob;
import com.caffio.printing.entity.PrintJobStatus;
import com.caffio.printing.entity.TicketType;

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