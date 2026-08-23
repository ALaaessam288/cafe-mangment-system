package com.example.cafemangmentsystem.auth.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class LoginPinRequest {
    @NotBlank
    private String tenantSlug;

    @NotBlank
    private String pin;
}
