package com.example.cafemangmentsystem.auth.dto;

import jakarta.validation.constraints.NotBlank;

public record LoginRequest(
        String tenantSlug,
        String username,
        @NotBlank(message = "كلمة المرور مطلوبة") String password
) {
}