package com.example.cafemangmentsystem.auth.dto;

public record LoginResponse(
        String token,
        String tokenType,
        String refreshToken,
        Long userId,
        String username,
        String fullName,
        String role
) {
}