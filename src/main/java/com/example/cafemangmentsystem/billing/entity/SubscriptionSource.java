package com.example.cafemangmentsystem.billing.entity;

/** How a subscription period came into existence — needed to attribute revenue correctly. */
public enum SubscriptionSource {
    TRIAL_SIGNUP,
    LICENSE_KEY,
    MANUAL_ADMIN,
    RENEWAL,
    MIGRATION
}
