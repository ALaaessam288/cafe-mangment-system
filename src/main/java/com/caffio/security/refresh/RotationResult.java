package com.caffio.security.refresh;

import com.caffio.user.entity.User;

public record RotationResult(User user, String rawRefreshToken) {
}