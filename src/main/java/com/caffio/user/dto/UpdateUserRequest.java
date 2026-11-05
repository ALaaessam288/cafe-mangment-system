package com.caffio.user.dto;

import com.caffio.user.entity.Role;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record UpdateUserRequest(
        @NotBlank String fullName,
        String username,
        @NotNull Role role,
        @Size(min = 4, max = 8) String pin
) {
}