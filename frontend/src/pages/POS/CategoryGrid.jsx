import soundEffects from '../../utils/soundEffects';

export default function CategoryGrid({
  categories = [],
  groupLabel = 'المنيو',
  groupIcon = '☕',
  onSelectCategory,
  onViewAll,
}) {
  const totalProducts = categories.reduce((sum, c) => sum + (c.productCount || 0), 0);

  return (
    <div className="pos-category-grid-container">
      {/* Creative Category Section Hero Header */}
      <div className="pos-category-hero">
        <div className="pos-category-hero__main">
          <div className="pos-category-hero__avatar">
            <span className="pos-category-hero__icon">{groupIcon}</span>
          </div>
          <div className="pos-category-hero__text">
            <div className="pos-category-hero__heading">
              <strong>أقسام {groupLabel}</strong>
              <span className="pos-category-hero__pill">{categories.length} أقسام • {totalProducts} صنف</span>
            </div>
            <small>اختر القسم المطلوب لتصفح منتجاته وطلباته</small>
          </div>
        </div>

        {categories.length > 1 && (
          <button
            type="button"
            className="pos-category-hero__all-btn"
            onClick={() => {
              soundEffects.playTap();
              onViewAll();
            }}
          >
            <span className="pos-category-hero__spark">✨</span>
            <span>عرض كل الأصناف ({totalProducts})</span>
          </button>
        )}
      </div>

      {/* Interactive Category Cards Grid */}
      <div className="pos-category-grid">
        {categories.map((cat, index) => {
          const visual = cat.visual || {};
          const catName = cat.displayName || cat.nameAr || cat.name || cat.nameEn || 'قسم';
          const count = cat.productCount || 0;
          const themeColor = visual.color || '#f59e0b';

          return (
            <button
              key={cat.id}
              type="button"
              className="pos-category-card"
              style={{
                '--cat-color': themeColor,
                animationDelay: `${index * 35}ms`,
              }}
              onClick={() => {
                soundEffects.playTap();
                onSelectCategory(cat.id);
              }}
            >
              {/* Ambient Glow Aura */}
              <div
                className="pos-category-card__aura"
                style={{
                  background: `radial-gradient(circle, ${themeColor}28 0%, transparent 70%)`,
                }}
              />

              {/* Glowing Icon Container */}
              <div
                className="pos-category-card__icon-wrap"
                style={{
                  background: `linear-gradient(135deg, ${themeColor}22 0%, rgba(255,255,255,0.03) 100%)`,
                  borderColor: `${themeColor}44`,
                  boxShadow: `0 4px 16px ${themeColor}22`,
                }}
              >
                <span className="pos-category-card__icon">{visual.icon || '☕'}</span>
              </div>

              {/* Category Info */}
              <div className="pos-category-card__info">
                <span className="pos-category-card__name" title={catName}>
                  {catName}
                </span>
                {visual.tag && (
                  <span className="pos-category-card__tag">
                    {visual.tag}
                  </span>
                )}
              </div>

              {/* Footer with Count and Arrow */}
              <div className="pos-category-card__footer">
                <span className="pos-category-card__count">
                  <span className="pos-category-card__dot" style={{ background: themeColor }} />
                  {count} {count === 1 ? 'صنف' : count === 2 ? 'صنفان' : 'أصناف'}
                </span>
                <span className="pos-category-card__action">
                  تصفح ←
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}


