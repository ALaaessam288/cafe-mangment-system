package com.example.cafemangmentsystem.order.dto;

import jakarta.validation.constraints.Min;

public record UpdateItemQuantityRequest(
        @Min(1) int quantity
) {
}
