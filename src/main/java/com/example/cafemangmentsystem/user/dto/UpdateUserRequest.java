package com.example.cafemangmentsystem.user.dto;

import com.example.cafemangmentsystem.user.entity.Role;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record UpdateUserRequest(
        @NotBlank String fullName,
        @NotNull Role role,
        @Size(min = 4, max = 8) String pin
) {
}