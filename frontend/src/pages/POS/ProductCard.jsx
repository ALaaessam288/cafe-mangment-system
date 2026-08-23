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
      <span className="menu-product__name">{product.name}</span>
      <span className="menu-product__footer">
        <span className="menu-product__price">{formatCurrency(product.price)}</span>
        <img 
          src={photoSrc} 
          className="menu-product__photo-badge" 
          alt="" 
          onError={(e) => { e.target.style.display = 'none'; }} 
        />
      </span>
    </button>
  );
}

export default memo(ProductCard);
