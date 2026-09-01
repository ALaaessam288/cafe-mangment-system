package com.example.cafemangmentsystem.cashmovement.entity;

public enum CashMovementType {
    FLOAT,            // عهدة افتتاحية
    CASH_IN,          // إيداع نقدي إضافي في الدرج (فكة)
    SAFE_DROP,        // سحب / ترحيل للخزنة الرئيسية (نقدية زائدة)
    CASH_OUT,         // سحب نقدي عام
    EXPENSE_PAYOUT    // سحب مصروف تشغيلي مباشر من الدرج
}
