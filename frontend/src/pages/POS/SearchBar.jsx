import { forwardRef } from 'react';
import { Search, X } from 'lucide-react';

/**
 * Cashier search box. The keyboard behaviour (focus / navigate / Enter / Escape)
 * is driven by MenuPanel so it can stay in sync with the visible result list.
 */
const SearchBar = forwardRef(function SearchBar(
  { value, onChange, onKeyDown, resultCount, hasQuery },
  ref
) {
  return (
    <div className="menu-search">
      <Search size={15} className="menu-search__icon" />
      <input
        ref={ref}
        type="text"
        className="menu-search__input"
        placeholder="ابحث عن صنف… (اضغط / للبحث السريع)"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={onKeyDown}
        autoComplete="off"
        spellCheck="false"
      />
      {hasQuery && (
        <>
          <span className="menu-search__count">{resultCount}</span>
          <button
            type="button"
            className="menu-search__clear"
            onClick={() => onChange('')}
            title="مسح البحث (Esc)"
            aria-label="مسح البحث"
          >
            <X size={13} />
          </button>
        </>
      )}
    </div>
  );
});

export default SearchBar;
