import { useState } from 'react';
import { Search } from 'lucide-react';
import Spinner from '../../components/Spinner/Spinner';
import { formatCurrency } from '../../utils/formatters';

export default function MenuPanel({
  categories,
  products,
  selectedCategoryId,
  loading,
  onCategorySelect,
  onProductClick,
}) {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredProducts = products.filter((p) =>
    p.name.toLowerCase().includes(searchQuery.trim().toLowerCase())
  );

  return (
    <div className="pos__menu">
      {/* Header with Search */}
      <div className="pos__panel-header" style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
        <span>المنيو</span>
        <div className="menu-search">
          <Search size={14} className="menu-search__icon" />
          <input
            type="text"
            className="menu-search__input"
            placeholder="بحث عن صنف..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Category Tabs */}
      <div className="menu-cats">
        <button
          className={`menu-cat ${!selectedCategoryId ? 'menu-cat--active' : ''}`}
          onClick={() => onCategorySelect(null)}
        >
          الكل
        </button>
        {categories.map((cat) => (
          <button
            key={cat.id}
            className={`menu-cat ${selectedCategoryId === cat.id ? 'menu-cat--active' : ''}`}
            onClick={() => onCategorySelect(cat.id)}
          >
            {cat.name}
          </button>
        ))}
      </div>

      {/* Product Grid */}
      {loading ? (
        <div className="pos__loading"><Spinner /></div>
      ) : filteredProducts.length === 0 ? (
        <div className="pos__empty">مفيش منتجات بالشكل ده.</div>
      ) : (
        <div className="menu-products">
          {filteredProducts.map((product) => (
            <button
              key={product.id}
              className="menu-product"
              onClick={() => onProductClick(product)}
              title={product.name}
            >
              <div className="menu-product__name">{product.name}</div>
              <div className="menu-product__price">{formatCurrency(product.price)}</div>
              {product.stationCode && (
                <div className="menu-product__station">
                  {product.stationCode === 'KITCHEN' ? '🍳 المطبخ' : product.stationCode === 'BAR' ? '☕ البار' : '📦 أخرى'}
                </div>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
