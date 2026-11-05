package com.caffio.user.entity;

public enum Role {
    CASHIER,
    SUPERVISOR,
    ADMIN,
    /** Platform-owner role — not tied to any single tenant's data. */
    SUPER_ADMIN
}
