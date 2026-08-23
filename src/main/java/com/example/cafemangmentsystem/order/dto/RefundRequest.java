package com.example.cafemangmentsystem.order.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.math.BigDecimal;

@Data
public class RefundRequest {
    private BigDecimal amount;
    
    private String reason;
}
