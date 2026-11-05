package com.caffio.printing.dto;

import com.caffio.printing.entity.PrintJobStatus;
import jakarta.validation.constraints.NotNull;

public record UpdatePrintJobStatusRequest(
        @NotNull PrintJobStatus status,
        String lastError
) {
}