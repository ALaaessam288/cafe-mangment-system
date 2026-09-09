package com.example.cafemangmentsystem.user.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;

/** Setting your own quick-login PIN. Guarded by the account password, not by an admin role. */
public record SelfPinRequest(
        @NotBlank(message = "كلمة المرور الحالية مطلوبة")
        String currentPassword,

        @NotBlank(message = "رمز PIN مطلوب")
        @Pattern(regexp = "\\d{4,8}", message = "رمز PIN يجب أن يكون من 4 إلى 8 أرقام")
        String pin
) {
}
