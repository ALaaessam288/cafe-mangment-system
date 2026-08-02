package com.example.cafemangmentsystem.order.entity;

/**
 * PAID and CLOSED are part of the documented lifecycle but are not reachable yet -
 * they require the Payment module (not built yet) to back them with a real transaction.
 */
public enum OrderStatus {
    OPEN,
    SENT,
    PAID,
    CLOSED,
    VOIDED
}