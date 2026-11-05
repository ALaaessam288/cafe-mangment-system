package com.caffio.register.dto;

import com.caffio.register.entity.Register;

public record RegisterResponse(
        Long id,
        String name,
        boolean active
) {
    public static RegisterResponse from(Register register) {
        return new RegisterResponse(register.getId(), register.getName(), register.isActive());
    }
}
