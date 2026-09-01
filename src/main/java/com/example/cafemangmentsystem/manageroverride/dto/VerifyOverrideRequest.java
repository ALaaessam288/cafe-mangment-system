package com.example.cafemangmentsystem.manageroverride.dto;

import com.example.cafemangmentsystem.manageroverride.entity.ManagerOverrideType;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.math.BigDecimal;

public record VerifyOverrideRequest(
        @NotBlank(message = "رمز المشرف PIN مطلوب")
        String supervisorPin,

        @NotNull(message = "نوع العملية مطلوب")
        ManagerOverrideType actionType,

        @NotBlank(message = "سبب الإلغاء / الاعتماد مطلوب")
        String reason,

        Long orderId,
        Long shiftId,
        BigDecimal amount,
        String details
) {}
