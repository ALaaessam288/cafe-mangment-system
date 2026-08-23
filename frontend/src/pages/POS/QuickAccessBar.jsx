import { History } from 'lucide-react';
import { formatCurrency } from '../../utils/formatters';

/**
 * Zero-navigation strip of the items this cashier rings up most often.
 * Hidden entirely until there's real history, so a fresh install shows nothing
 * misleading.
 */
export default function QuickAccessBar({ products, onProductClick }) {
  if (!products?.length) return null;

  return (
    <div className="quick-access">
      <span className="quick-access__label" title="أكثر أصنافك استخدامًا">
        <History size={13} />
      </span>
      <div className="quick-access__list">
        {products.map((product) => (
          <button
            key={product.id}
            type="button"
            className="quick-access__chip"
            onClick={() => onProductClick(product)}
            title={`${product.name} — ${formatCurrency(product.price)}`}
          >
            <span className="quick-access__name">{product.name}</span>
            <span className="quick-access__price">{formatCurrency(product.price)}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
