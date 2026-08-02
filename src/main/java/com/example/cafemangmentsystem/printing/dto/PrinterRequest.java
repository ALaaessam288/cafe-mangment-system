package com.example.cafemangmentsystem.printing.dto;

import com.example.cafemangmentsystem.printing.entity.PrinterType;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public record PrinterRequest(
        @NotBlank String name,
        @NotBlank String ipAddress,
        @NotNull @Min(1) @Max(65535) Integer port,
        @NotNull PrinterType type,
        @NotNull Integer paperWidth
) {
}