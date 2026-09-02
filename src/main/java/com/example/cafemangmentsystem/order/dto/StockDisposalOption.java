package com.example.cafemangmentsystem.order.dto;

public enum StockDisposalOption {
    NO_STOCK_EFFECT,    // Financial refund only, no stock adjustments
    RETURN_TO_STOCK,    // Items are in good condition, restock inventory
    WASTE               // Items are spoiled/discarded, record as stock waste
}
