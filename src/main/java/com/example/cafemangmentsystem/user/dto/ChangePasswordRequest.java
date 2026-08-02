package com.example.cafemangmentsystem.user.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record ChangePasswordRequest(
        @NotBlank @Size(min = 6) String newPassword
) {
}