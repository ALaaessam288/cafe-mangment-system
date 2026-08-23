package com.example.cafemangmentsystem.auth.dto;

import jakarta.validation.constraints.NotBlank;

public record LoginRequest(
        @NotBlank String tenantSlug,
        String username,
        @NotBlank String password
) {
}