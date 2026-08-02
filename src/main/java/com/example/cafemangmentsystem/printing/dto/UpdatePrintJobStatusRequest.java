package com.example.cafemangmentsystem.printing.dto;

import com.example.cafemangmentsystem.printing.entity.PrintJobStatus;
import jakarta.validation.constraints.NotNull;

public record UpdatePrintJobStatusRequest(
        @NotNull PrintJobStatus status,
        String lastError
) {
}