package com.example.cafemangmentsystem.order.entity;

/**
 * SERVED and READY_FOR_PICKUP are the same conceptual step ("kitchen work is done and it's with
 * the customer") but split by {@link OrderType}: SERVED for dine-in (delivered to the table),
 * READY_FOR_PICKUP for takeaway (waiting at the counter). Both accept new items/payment the same
 * way SENT does.
 */
public enum OrderStatus {
    OPEN,
    SENT,
    SERVED,
    READY_FOR_PICKUP,
    PAID,
    CLOSED,
    VOIDED,
    REFUNDED
}