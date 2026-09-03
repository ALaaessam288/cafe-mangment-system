package com.example.cafemangmentsystem.billing.entity;

/** Where a customer's upgrade request has got to. */
public enum UpgradeRequestStatus {
    /** Submitted, waiting for the platform to confirm the money arrived. */
    PENDING,
    /** Money confirmed; the subscription was moved onto the requested plan. */
    APPROVED,
    /** Declined — no payment found, or the customer withdrew it. */
    REJECTED,
    /** Superseded by a licence key or an admin plan change before anyone reviewed it. */
    CANCELLED
}
