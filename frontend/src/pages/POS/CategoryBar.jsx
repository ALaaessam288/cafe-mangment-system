import { TOP_SELLERS_ID } from './menuGroups';

/**
 * Two rows, both optional for the cashier:
 *  1. A handful of top-level groups, starting with ⭐ الأكثر طلبًا (the default).
 *  2. The REAL categories inside the selected group - only rendered when the
 *     group actually contains more than one, so most flows stay at one click.
 */
export default function CategoryBar({
  groups,
  activeGroupId,
  activeCategoryId,
  onGroupSelect,
  onCategorySelect,
}) {
  const activeGroup = groups.find((g) => g.id === activeGroupId);
  const subCategories = activeGroup?.categories ?? [];
  const showSubRow = activeGroupId !== TOP_SELLERS_ID && subCategories.length > 1;

  return (
    <div className="menu-groups-wrap">
      <div className="menu-groups" role="tablist" aria-label="أقسام المنيو">
        <button
          type="button"
          role="tab"
          aria-selected={activeGroupId === TOP_SELLERS_ID}
          className={`menu-group ${activeGroupId === TOP_SELLERS_ID ? 'menu-group--active' : ''} menu-group--top`}
          onClick={() => onGroupSelect(TOP_SELLERS_ID)}
        >
          <img src="/images/categories/top_sellers.jpg" className="menu-group__photo" alt="الأكثر طلباً" />
          <span>الأكثر طلبًا</span>
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
          </button>
        ))}
      </div>

      {showSubRow && (
        <div className="menu-subcats">
          <button
            type="button"
            className={`menu-subcat ${activeCategoryId == null ? 'menu-subcat--active' : ''}`}
            onClick={() => onCategorySelect(null)}
          >
            الكل
          </button>
          {subCategories.map((cat) => (
            <button
              key={cat.id}
              type="button"
              className={`menu-subcat ${activeCategoryId === cat.id ? 'menu-subcat--active' : ''}`}
              onClick={() => onCategorySelect(cat.id)}
            >
              {cat.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
