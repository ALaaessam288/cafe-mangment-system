import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import SearchBar from './SearchBar';
import CategoryBar from './CategoryBar';
import CategoryGrid from './CategoryGrid';
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
 * Supports the 3 main super groups (مشروبات 🥤, مأكولات 🍽️, حلويات 🍰) + الأكثر طلباً ⭐.
 * Clicking a group presents interactive Category Cards, allowing the cashier to choose
 * the desired category before viewing its products, with seamless 1-tap back navigation.
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
    // Search always spans the entire menu
    if (searchQuery.trim()) return searchProducts(products, searchQuery, categories);
    if (activeGroupId === TOP_SELLERS_ID) return topProducts;
    return productsForGroup(products, activeGroup, activeCategoryId);
  }, [searchQuery, products, categories, activeGroupId, activeGroup, activeCategoryId, topProducts]);

  const isSearching = searchQuery.trim().length > 0;

  // Decide whether to show category cards grid or products grid
  const shouldShowCategoryCards =
    !isSearching &&
    activeGroupId !== TOP_SELLERS_ID &&
    activeCategoryId === null &&
    (activeGroup?.categories?.length > 1);

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
        <div className="pos__menu-title">
          <span>02</span>
          <strong>المنيو</strong>
          <small>اختار الصنف — ضغطة واحدة تضيفه للأوردر</small>
        </div>
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

      {/* Active Category Breadcrumb Bar when browsing inside a category */}
      {!isSearching && activeGroupId !== TOP_SELLERS_ID && activeCategoryId !== null && (
        <div className="pos-category-active-bar animate-fade-in">
          <button
            type="button"
            className="pos-category-back-btn"
            onClick={() => setActiveCategoryId(null)}
            title={`رجوع لكافة أقسام ${activeGroup?.label || ''}`}
          >
            <span>🔙</span>
            <strong>رجوع لأقسام {activeGroup?.label || ''}</strong>
          </button>
          <div className="pos-category-active-info">
            <span className="pos-category-active-name">
              {activeCategoryId === 'ALL'
                ? `كل أصناف ${activeGroup?.label || ''}`
                : (activeGroup?.categories?.find((c) => c.id === activeCategoryId)?.displayName ||
                   activeGroup?.categories?.find((c) => c.id === activeCategoryId)?.name ||
                   'القسم')}
            </span>
            <span className="pos-category-active-count">({visibleProducts.length} صنف)</span>
          </div>
        </div>
      )}

      {/* Show Category Cards Grid or Products Grid */}
      {shouldShowCategoryCards ? (
        <CategoryGrid
          categories={activeGroup.categories}
          groupLabel={activeGroup.label}
          groupIcon={activeGroup.icon}
          onSelectCategory={setActiveCategoryId}
          onViewAll={() => setActiveCategoryId('ALL')}
        />
      ) : (
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
      )}
    </section>
  );
}

