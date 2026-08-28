package com.example.cafemangmentsystem.user.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record ChangePasswordRequest(
        @NotBlank(message = "كلمة المرور الجديدة مطلوبة")
        @Size(min = 6, message = "يجب أن تتكون كلمة المرور من 6 أحرف على الأقل")
        String newPassword
) {
}
