package com.example.cafemangmentsystem.billing.entity;

/**
 * The countable resources a plan puts a ceiling on. {@link #UNLIMITED} is the single sentinel
 * for "no ceiling" — the old model used 9999, which the quota checker then enforced as a real
 * hard stop, so an "unlimited" ENTERPRISE tenant would have been blocked at 9999 tables.
 */
public enum QuotaType {
    TABLES("الطاولات", "طاولة"),
    USERS("المستخدمين", "مستخدم"),
    PRODUCTS("الأصناف", "صنف");

    public static final int UNLIMITED = -1;

    private final String displayNameAr;
    private final String unitAr;

    QuotaType(String displayNameAr, String unitAr) {
        this.displayNameAr = displayNameAr;
        this.unitAr = unitAr;
    }

    public String getDisplayNameAr() { return displayNameAr; }
    public String getUnitAr() { return unitAr; }

    public static boolean isUnlimited(int limit) {
        return limit == UNLIMITED;
    }
}
