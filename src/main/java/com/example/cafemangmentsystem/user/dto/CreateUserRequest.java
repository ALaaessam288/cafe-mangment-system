package com.example.cafemangmentsystem.user.dto;

import com.example.cafemangmentsystem.user.entity.Role;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record CreateUserRequest(
        @NotBlank String username,
        @NotBlank @Size(min = 6) String password,
        @NotBlank String fullName,
        @Size(min = 4, max = 8) String pin,
        @NotNull Role role
) {
}