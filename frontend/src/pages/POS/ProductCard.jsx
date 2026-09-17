import { memo } from 'react';
import { formatCurrency } from '../../utils/formatters';
import { isFoodProduct } from './menuGroups';

/**
 * One tap = one item on the bill.
 *
 * <p>No photograph. Every card used to carry one - the product's own image if it had one, and
 * otherwise a stock shot of "food" or "a hot drink" shared with every other item in its half of
 * the menu. On a wall of small tiles that means most cards show a picture that is not of the
 * thing being sold, which is worse than no picture: the cashier learns to read past the image to
 * the name, so the image is costing space and bandwidth to be ignored. The name and the price are
 * what get read. The coloured edge stays as the station indicator (kitchen vs bar).
 */
function ProductCard({ product, highlighted, onClick, onDetails, innerRef }) {
  const food = isFoodProduct(product);
  return (
    <button
      ref={innerRef}
      type="button"
      className={`menu-product ${food ? 'menu-product--food' : 'menu-product--drink'} ${
        highlighted ? 'menu-product--highlighted' : ''
      }`}
      onClick={() => onClick(product)}
      onContextMenu={(e) => {
        if (!onDetails) return;
        e.preventDefault();
        onDetails(product);
      }}
      title={`${product.name} — ${formatCurrency(product.price)}\n(كليك يمين: كمية / ملاحظة)`}
    >
      <span className="menu-product__name">{product.name}</span>
      <span className="menu-product__footer">
        <span className="menu-product__price">{formatCurrency(product.price)}</span>
        {/* The "+ إضافة" label was here. It said the same thing on every card on the screen, and
            what it said - that tapping a product adds it - is the one thing a cashier learns in
            their first minute and then never needs told again. A line of text repeated forty
            times that nobody reads is just height, and height is what this card is short of. */}
      </span>

      {/* Stock Progress Bar Indicator */}
      {(() => {
        const currentStock = product.availableQuantity !== undefined ? product.availableQuantity : (product.stockQuantity ?? 0);
        const hasStock = product.trackInventory || product.recipeInventory;
        if (!hasStock) return null;
        const threshold = product.minStockThreshold ? product.minStockThreshold * 3 : 20;
        const percent = Math.min(100, Math.max(0, (currentStock / threshold) * 100));
        return (
          <>
            <div
              className="menu-product__stock-track"
              title={product.recipeInventory ? `المتاح إنتاجه من الخامات: ${currentStock}` : `المتاح للبيع الآن: ${currentStock}`}
              style={{
                width: '100%',
                height: '4px',
                background: 'rgba(255, 255, 255, 0.1)',
                borderRadius: '2px',
                marginTop: '4px',
                overflow: 'hidden',
                position: 'relative'
              }}
            >
              <div
                className="menu-product__stock-fill"
                style={{
                  height: '100%',
                  width: `${percent}%`,
                  background: currentStock <= 3
                    ? 'linear-gradient(90deg, #e56273, #d44f61)'
                    : currentStock <= 10
                      ? 'linear-gradient(90deg, #a99cff, #7468d8)'
                      : 'linear-gradient(90deg, #64d7bd, #4bbfa5)',
                  transition: 'width 0.3s ease',
                  borderRadius: '2px'
                }}
              />
            </div>
            {currentStock <= 10 && (
              <span
                style={{
                  position: 'absolute',
                  top: '4px',
                  left: '4px',
                  fontSize: '9px',
                  fontWeight: 'bold',
                  padding: '1px 5px',
                  borderRadius: '4px',
                  background: currentStock <= 3 ? '#e56273' : '#a99cff',
                  color: '#ffffff',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.3)'
                }}
              >
                {currentStock <= 0 ? 'نفذ' : `باقي ${currentStock}`}
              </span>
            )}
          </>
        );
      })()}
    </button>
  );
}

export default memo(ProductCard);
