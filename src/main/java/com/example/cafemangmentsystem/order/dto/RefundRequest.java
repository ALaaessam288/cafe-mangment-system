package com.example.cafemangmentsystem.order.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.math.BigDecimal;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class RefundRequest {
    @NotNull(message = "مبلغ الإرجاع مطلوب")
    @Positive(message = "يجب أن يكون مبلغ الإرجاع أكبر من صفر")
    private BigDecimal amount;

    @NotBlank(message = "سبب الإرجاع مطلوب")
    private String reason;

    public BigDecimal getAmount() { return amount; }
    public void setAmount(BigDecimal amount) { this.amount = amount; }

    public String getReason() { return reason; }
    public void setReason(String reason) { this.reason = reason; }
}
