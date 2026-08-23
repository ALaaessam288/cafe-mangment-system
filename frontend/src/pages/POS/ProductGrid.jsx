import Spinner from '../../components/Spinner/Spinner';
import ProductCard from './ProductCard';

export default function ProductGrid({ products, loading, highlightIndex, onProductClick, onProductDetails, cardRefs, emptyText }) {
  if (loading) {
    return <div className="pos__loading"><Spinner /></div>;
  }

  if (products.length === 0) {
    return <div className="pos__empty">{emptyText ?? 'مفيش أصناف هنا.'}</div>;
  }

  return (
    <div className="menu-products">
      {products.map((product, index) => (
        <ProductCard
          key={product.id}
          product={product}
          highlighted={index === highlightIndex}
          onClick={onProductClick}
          onDetails={onProductDetails}
          innerRef={cardRefs ? (el) => { cardRefs.current[index] = el; } : undefined}
        />
      ))}
    </div>
  );
}
