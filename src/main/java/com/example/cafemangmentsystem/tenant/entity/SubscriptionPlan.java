package com.example.cafemangmentsystem.tenant.entity;

import lombok.Getter;

@Getter
public enum SubscriptionPlan {
    TRIAL("فترة تجريبية", 0, 5, 2, 30, false, false, false),
    STARTER("باقة الكافيه الأساسية", 499, 20, 5, 100, true, false, false),
    PRO("الباقة الاحترافية", 899, 50, 15, 500, true, true, true),
    ENTERPRISE("الباقة الشاملة (غير محدودة)", 1499, 9999, 9999, 9999, true, true, true),
    CUSTOM("باقة مخصصة (Custom Plan)", 0, 50, 10, 500, true, true, true);

    private final String displayName;
    private final int monthlyPriceEgp;
    private final int maxTables;
    private final int maxUsers;
    private final int maxProducts;
    private final boolean includesExpenses;
    private final boolean includesKds;
    private final boolean includesMultiRegister;

    SubscriptionPlan(String displayName, int monthlyPriceEgp, int maxTables, int maxUsers, int maxProducts,
                     boolean includesExpenses, boolean includesKds, boolean includesMultiRegister) {
        this.displayName = displayName;
        this.monthlyPriceEgp = monthlyPriceEgp;
        this.maxTables = maxTables;
        this.maxUsers = maxUsers;
        this.maxProducts = maxProducts;
        this.includesExpenses = includesExpenses;
        this.includesKds = includesKds;
        this.includesMultiRegister = includesMultiRegister;
    }

    public String getDisplayName() { return displayName; }
    public int getMonthlyPriceEgp() { return monthlyPriceEgp; }
    public int getMaxTables() { return maxTables; }
    public int getMaxUsers() { return maxUsers; }
    public int getMaxProducts() { return maxProducts; }
    public boolean isIncludesExpenses() { return includesExpenses; }
    public boolean isIncludesKds() { return includesKds; }
    public boolean isIncludesMultiRegister() { return includesMultiRegister; }
}
