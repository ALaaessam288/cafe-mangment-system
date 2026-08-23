package com.example.cafemangmentsystem.order.dto;

import jakarta.validation.constraints.NotNull;

public record TransferTableRequest(
        @NotNull Long tableId,
        boolean merge
) {
}