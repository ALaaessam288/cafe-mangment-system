package com.example.cafemangmentsystem.menu.entity;

public enum RevenueLine {
    FOOD,
    BUFFET,
    /** Only meaningful for Expense - a cost that isn't attributable to one revenue line alone (e.g. rent). */
    SHARED
}