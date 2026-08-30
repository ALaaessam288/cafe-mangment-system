import soundEffects from '../../utils/soundEffects';

export default function CategoryGrid({
  categories = [],
  groupLabel = 'المنيو',
  groupIcon = '☕',
  onSelectCategory,
  onViewAll,
}) {
  return (
    <div className="pos-category-grid-container animate-fade-in-up">
      {/* Category Section Header */}
      <div className="pos-category-grid__header">
        <div className="pos-category-grid__title">
          <span className="pos-category-grid__icon">{groupIcon}</span>
          <div>
            <strong>أقسام {groupLabel}</strong>
            <small>اختر القسم المطلوب لتصفح أصنافه</small>
          </div>
        </div>

        {categories.length > 1 && (
          <button
            type="button"
            className="pos-category-grid__view-all-btn"
            onClick={() => {
              soundEffects.playTap();
              onViewAll();
            }}
          >
            <span>عرض كل الأصناف معاً 📋</span>
          </button>
        )}
      </div>

      {/* Category Cards Grid */}
      <div className="pos-category-grid">
        {categories.map((cat) => {
          const visual = cat.visual || {};
          const catName = cat.displayName || cat.nameAr || cat.name || cat.nameEn || 'قسم';
          const count = cat.productCount || 0;

          return (
            <button
              key={cat.id}
              type="button"
              className="pos-category-card"
              onClick={() => {
                soundEffects.playTap();
                onSelectCategory(cat.id);
              }}
            >
              <div
                className="pos-category-card__icon-wrap"
                style={{
                  background: visual.color
                    ? `radial-gradient(circle, ${visual.color}33 0%, rgba(255,255,255,0.02) 80%)`
                    : 'var(--bg-secondary)',
                  borderColor: visual.color ? `${visual.color}55` : 'var(--border-subtle)',
                }}
              >
                <span className="pos-category-card__icon">{visual.icon || '☕'}</span>
              </div>

              <span className="pos-category-card__name" title={catName}>
                {catName}
              </span>

              <span className="pos-category-card__count">
                {count} {count === 1 ? 'صنف' : count === 2 ? 'صنفان' : 'أصناف'}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

