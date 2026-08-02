package com.example.cafemangmentsystem.security.refresh;

import com.example.cafemangmentsystem.user.entity.User;

public record RotationResult(User user, String rawRefreshToken) {
}