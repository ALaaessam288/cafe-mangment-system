package com.example.cafemangmentsystem.user.dto;

import com.example.cafemangmentsystem.user.entity.Role;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record CreateUserRequest(
        @NotBlank(message = "اسم المستخدم مطلوب")
        String username,

        @NotBlank(message = "كلمة المرور مطلوبة")
        @Size(min = 6, message = "يجب أن تتكون كلمة المرور من 6 أحرف على الأقل")
        String password,

        @NotBlank(message = "الاسم الكامل مطلوب")
        String fullName,

        @Size(min = 4, max = 8, message = "يجب أن يتكون رمز PIN من 4 إلى 8 أرقام")
        String pin,

        @NotNull(message = "دور وصلاحية المستخدم مطلوبة")
        Role role
) {
}
