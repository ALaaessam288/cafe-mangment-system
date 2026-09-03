package com.example.cafemangmentsystem.billing.dto;

/** What a tenant is allowed to do right now, derived from its subscription state. */
public enum AccessLevel {
    /** Reads and writes. */
    FULL,
    /** Reads only — the subscription lapsed past its grace window, or was cancelled. */
    READ_ONLY,
    /** Nothing, including reads — suspended by the platform. */
    BLOCKED
}
