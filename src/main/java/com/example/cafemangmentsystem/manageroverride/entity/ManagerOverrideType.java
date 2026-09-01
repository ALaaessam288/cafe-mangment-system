package com.example.cafemangmentsystem.manageroverride.entity;

public enum ManagerOverrideType {
    VOID_ITEM,             // إلغاء صنف بعد إرساله للمطبخ
    VOID_ORDER,            // إلغاء فاتورة / أوردر بالكامل
    REFUND_ORDER,          // استرجاع مبلغ للعميل
    CUSTOM_DISCOUNT,       // تطبيق خصم مخصص / نسبة خصم
    PRICE_OVERRIDE,        // تعديل سعر صنف يدوياً
    NO_SALE_DRAWER_KICK,   // فتح درج النقدية بدون عملية بيع
    SAFE_DROP_OVERRIDE     // اعتماد سحب نقدي كبير
}
