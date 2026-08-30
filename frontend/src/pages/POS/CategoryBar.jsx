import { TOP_SELLERS_ID } from './menuGroups';

export default function CategoryBar({
  groups,
  activeGroupId,
  activeCategoryId,
  onGroupSelect,
  onCategorySelect,
}) {
  const activeGroup = groups.find((g) => g.id === activeGroupId);
  const subCategories = activeGroup?.categories ?? [];
  const showSubRow = activeGroupId !== TOP_SELLERS_ID && activeCategoryId !== null;

  return (
    <div className="menu-groups-wrap">
      {/* Top Level Main Groups (الأكثر طلباً, مشروبات, مأكولات, حلويات, إضافات) */}
      <div className="menu-groups" role="tablist" aria-label="أقسام المنيو الرئيسية">
        <button
          type="button"
          role="tab"
          aria-selected={activeGroupId === TOP_SELLERS_ID}
          className={`menu-group ${activeGroupId === TOP_SELLERS_ID ? 'menu-group--active' : ''} menu-group--top`}
          onClick={() => onGroupSelect(TOP_SELLERS_ID)}
        >
          <img src="/images/categories/top_sellers.jpg" className="menu-group__photo" alt="الأكثر طلباً" />
          <span>الأكثر طلبًا ⭐</span>
        </button>

        {groups.map((group) => (
          <button
            key={group.id}
            type="button"
            role="tab"
            aria-selected={activeGroupId === group.id}
            className={`menu-group ${activeGroupId === group.id ? 'menu-group--active' : ''}`}
            onClick={() => onGroupSelect(group.id)}
          >
            {group.photo ? (
              <img src={group.photo} className="menu-group__photo" alt={group.label} />
            ) : (
              <span className="menu-group__icon">{group.icon}</span>
            )}
            <span>{group.label}</span>
            <span className="menu-group__badge">{group.categories?.length || 0}</span>
          </button>
        ))}
      </div>

      {/* Subcategory Pills when inside a Category */}
      {showSubRow && (
        <div className="menu-subcats animate-fade-in">
          <button
            type="button"
            className="menu-subcat menu-subcat--back"
            onClick={() => onCategorySelect(null)}
            title={`رجوع لكروت أقسام ${activeGroup?.label || ''}`}
          >
            <span>🔙 أقسام {activeGroup?.label || ''}</span>
          </button>

          <button
            type="button"
            className={`menu-subcat ${activeCategoryId === 'ALL' ? 'menu-subcat--active' : ''}`}
            onClick={() => onCategorySelect('ALL')}
          >
            كل الأصناف 📋
          </button>

          {subCategories.map((cat) => {
            const catName = cat.displayName || cat.nameAr || cat.name || cat.nameEn;
            const visual = cat.visual || {};
            return (
              <button
                key={cat.id}
                type="button"
                className={`menu-subcat ${activeCategoryId === cat.id ? 'menu-subcat--active' : ''}`}
                onClick={() => onCategorySelect(cat.id)}
              >
                <span>{visual.icon || '☕'}</span>
                <span>{catName}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

