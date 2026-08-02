package com.example.cafemangmentsystem.register.dto;

import jakarta.validation.constraints.NotBlank;

public record RegisterRequest(
        @NotBlank String name
) {
}
