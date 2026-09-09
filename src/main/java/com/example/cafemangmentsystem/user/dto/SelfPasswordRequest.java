package com.example.cafemangmentsystem.user.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * Changing your own password. Unlike {@link ChangePasswordRequest} - which is an administrator
 * resetting someone else's credentials - this one proves the caller knows the password it is
 * replacing, so an unattended terminal cannot be used to take over the account sitting on it.
 */
public record SelfPasswordRequest(
        @NotBlank(message = "كلمة المرور الحالية مطلوبة")
        String currentPassword,

        @NotBlank(message = "كلمة المرور الجديدة مطلوبة")
        @Size(min = 6, message = "يجب أن تتكون كلمة المرور من 6 أحرف على الأقل")
        String newPassword
) {
}
