package com.example.cafemangmentsystem.user.dto;

import com.example.cafemangmentsystem.user.entity.Role;
import com.example.cafemangmentsystem.user.entity.User;

import java.time.Instant;

public record UserResponse(
        Long id,
        String username,
        String fullName,
        Role role,
        boolean active,
        Instant createdAt
) {
    public static UserResponse from(User user) {
        return new UserResponse(user.getId(), user.getUsername(), user.getFullName(),
                user.getRole(), user.isActive(), user.getCreatedAt());
    }
}