package com.example.cafemangmentsystem.billing.entity;

/**
 * A capability a plan may or may not include. Replaces the three ad-hoc booleans that used to
 * live on the {@code SubscriptionPlan} enum, and the path-prefix string matching that used to
 * enforce them inside the servlet filter.
 *
 * <p>Adding a feature here is additive: existing plans simply don't have it until a row is
 * inserted into {@code plan_features}, so a new feature is locked by default rather than open.
 */
public enum Feature {
    POS("نقاط البيع"),
    KDS("شاشة تحضير المطبخ"),
    EXPENSES("المصروفات والنثريات"),
    DEBTS("الديون والآجل"),
    INVENTORY("المخزون"),
    PAYROLL("الرواتب والسلف"),
    REPORTS("التقارير المتقدمة"),
    MULTI_REGISTER("تعدد الخزائن"),
    THERMAL_PRINT("الطباعة الحرارية"),
    DISCOUNTS("الخصومات والعروض"),
    MANAGER_OVERRIDE("صلاحيات المدير الاستثنائية"),
    CUSTOM_BRANDING("الهوية والشعار المخصص"),
    WHATSAPP_ALERTS("تنبيهات واتساب"),
    MULTI_BRANCH("تعدد الفروع");

    private final String displayNameAr;

    Feature(String displayNameAr) {
        this.displayNameAr = displayNameAr;
    }

    public String getDisplayNameAr() {
        return displayNameAr;
    }
}
