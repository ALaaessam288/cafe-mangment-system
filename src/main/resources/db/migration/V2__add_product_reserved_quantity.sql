-- Soft reservation counter: quantity held by NEW (not yet sent) order items, so on-screen
-- availability can reflect items already in a cart across cashiers before they're actually
-- deducted from stock_quantity at send() time. See Product.reservedQuantity / OrderService.
ALTER TABLE products ADD COLUMN IF NOT EXISTS reserved_quantity INT NOT NULL DEFAULT 0;
