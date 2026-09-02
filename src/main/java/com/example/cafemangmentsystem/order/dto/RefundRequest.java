package com.example.cafemangmentsystem.order.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class RefundRequest {
    private BigDecimal amount;
    @NotBlank(message = "سبب الإرجاع مطلوب")
    private String reason;
    private StockDisposalOption stockDisposal = StockDisposalOption.NO_STOCK_EFFECT;
}
