package com.caffio.user.dto;

import com.caffio.user.entity.Role;
import com.caffio.user.entity.User;

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