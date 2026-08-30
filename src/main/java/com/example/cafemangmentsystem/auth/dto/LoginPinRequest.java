package com.example.cafemangmentsystem.auth.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class LoginPinRequest {
    @NotBlank
    private String tenantSlug;

    @NotBlank
    private String pin;

    public String getTenantSlug() { return tenantSlug; }
    public void setTenantSlug(String tenantSlug) { this.tenantSlug = tenantSlug; }

    public String getPin() { return pin; }
    public void setPin(String pin) { this.pin = pin; }
}
