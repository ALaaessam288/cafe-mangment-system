import { memo } from 'react';
import { formatCurrency } from '../../utils/formatters';
import { isFoodProduct } from './menuGroups';

/**
 * One tap = one item on the bill. Name + price only, nothing else competing
 * for the cashier's eye. The coloured edge is the station indicator
 * (kitchen vs bar) that already existed.
 */
function ProductCard({ product, highlighted, onClick, onDetails, innerRef }) {
  const food = isFoodProduct(product);
  const photoSrc = product.image || (food ? '/images/categories/food.jpg' : '/images/categories/hot.jpg');
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
      <img
        src={photoSrc}
        className="menu-product__visual"
        alt=""
        onError={(e) => { e.currentTarget.style.display = 'none'; }}
      />
      <span className="menu-product__shade" aria-hidden="true" />
      <span className="menu-product__name">{product.name}</span>
      <span className="menu-product__footer">
        <span className="menu-product__price">{formatCurrency(product.price)}</span>
        <span className="menu-product__tap">+ إضافة</span>
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
                    ? 'linear-gradient(90deg, #ef4444, #dc2626)'
                    : currentStock <= 10
                      ? 'linear-gradient(90deg, #f59e0b, #d97706)'
                      : 'linear-gradient(90deg, #10b981, #059669)',
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
                  background: currentStock <= 3 ? '#ef4444' : '#f59e0b',
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
