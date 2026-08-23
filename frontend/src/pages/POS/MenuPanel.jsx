import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import SearchBar from './SearchBar';
import CategoryBar from './CategoryBar';
import ProductGrid from './ProductGrid';
import QuickAccessBar from './QuickAccessBar';
import {
  TOP_SELLERS_ID,
  buildMenuGroups,
  productsForGroup,
  searchProducts,
} from './menuGroups';

/**
 * The cashier's product area.
 *
 * Defaults to ⭐ الأكثر طلبًا so the common items are one click away, keeps the
 * top-level tabs down to a handful of groups, and searches the WHOLE menu
 * (not just the open category) as the cashier types.
 */
export default function MenuPanel({
  categories,
  products,
  topProducts,
  quickAccessProducts,
  loading,
  multiplier = 1,
  onProductClick,
  onProductDetails,
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeGroupId, setActiveGroupId] = useState(TOP_SELLERS_ID);
  const [activeCategoryId, setActiveCategoryId] = useState(null);
  const [highlightIndex, setHighlightIndex] = useState(0);

  const searchRef = useRef(null);
  const cardRefs = useRef([]);

  const groups = useMemo(() => buildMenuGroups(categories, products), [categories, products]);
  const activeGroup = groups.find((g) => g.id === activeGroupId) ?? null;

  const visibleProducts = useMemo(() => {
    // Search always spans the entire menu - the cashier shouldn't have to be in
    // the right category first.
    if (searchQuery.trim()) return searchProducts(products, searchQuery, categories);
    if (activeGroupId === TOP_SELLERS_ID) return topProducts;
    return productsForGroup(products, activeGroup, activeCategoryId);
  }, [searchQuery, products, categories, activeGroupId, activeGroup, activeCategoryId, topProducts]);

  const isSearching = searchQuery.trim().length > 0;

  useEffect(() => {
    setHighlightIndex(0);
    cardRefs.current = [];
  }, [searchQuery, activeGroupId, activeCategoryId]);

  /* Keep the highlighted card in view while arrowing through results. */
  useEffect(() => {
    if (!isSearching) return;
    cardRefs.current[highlightIndex]?.scrollIntoView({ block: 'nearest' });
  }, [highlightIndex, isSearching]);

  /* "/" or F2 jumps to search from anywhere on the cashier screen. */
  useEffect(() => {
    function onGlobalKeyDown(e) {
      const el = e.target;
      const typing = el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable);
      if (e.key === 'F2' || (e.key === '/' && !typing)) {
        e.preventDefault();
        searchRef.current?.focus();
        searchRef.current?.select();
      }
    }
    window.addEventListener('keydown', onGlobalKeyDown);
    return () => window.removeEventListener('keydown', onGlobalKeyDown);
  }, []);

  const handleSearchKeyDown = useCallback(
    (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        if (searchQuery) setSearchQuery('');
        else searchRef.current?.blur();
        return;
      }
      if (!visibleProducts.length) return;

      // RTL layout: ArrowLeft moves forward through the grid, ArrowRight back.
      const forward = ['ArrowDown', 'ArrowLeft'];
      const backward = ['ArrowUp', 'ArrowRight'];

      if (forward.includes(e.key)) {
        e.preventDefault();
        setHighlightIndex((i) => Math.min(i + 1, visibleProducts.length - 1));
      } else if (backward.includes(e.key)) {
        e.preventDefault();
        setHighlightIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const product = visibleProducts[highlightIndex] ?? visibleProducts[0];
        if (product) {
          onProductClick(product);
          setSearchQuery('');
        }
      }
    },
    [visibleProducts, highlightIndex, onProductClick, searchQuery]
  );

  function handleGroupSelect(groupId) {
    setSearchQuery('');
    setActiveGroupId(groupId);
    setActiveCategoryId(null);
  }

  return (
    <section className="pos__menu">
      <div className="pos__menu-header">
        <SearchBar
          ref={searchRef}
          value={searchQuery}
          onChange={setSearchQuery}
          onKeyDown={handleSearchKeyDown}
          resultCount={visibleProducts.length}
          hasQuery={isSearching}
        />

        {!isSearching && (
          <CategoryBar
            groups={groups}
            activeGroupId={activeGroupId}
            activeCategoryId={activeCategoryId}
            onGroupSelect={handleGroupSelect}
            onCategorySelect={setActiveCategoryId}
          />
        )}

        {isSearching && (
          <div className="menu-search-hint">
            نتائج البحث في المنيو كله — <kbd>Enter</kbd> يضيف المحدَّد، <kbd>Esc</kbd> يمسح البحث
          </div>
        )}

        {multiplier > 1 && (
          <div className="menu-multiplier">
            الكمية التالية: <strong>×{multiplier}</strong> — دوس على الصنف، أو <kbd>Esc</kbd> للإلغاء
          </div>
        )}
      </div>

      {!isSearching && (
        <QuickAccessBar products={quickAccessProducts} onProductClick={onProductClick} />
      )}

      <ProductGrid
        products={visibleProducts}
        loading={loading}
        highlightIndex={isSearching ? highlightIndex : -1}
        onProductClick={onProductClick}
        onProductDetails={onProductDetails}
        cardRefs={cardRefs}
        emptyText={
          isSearching
            ? 'مفيش صنف بالاسم ده.'
            : activeGroupId === TOP_SELLERS_ID
              ? 'لسه مفيش مبيعات كفاية — اختار قسم من فوق.'
              : 'مفيش أصناف متاحة في القسم ده.'
        }
      />
    </section>
  );
}
