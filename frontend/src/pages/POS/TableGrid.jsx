import { useState, useMemo } from 'react';
import { Lock, PanelLeftClose, PanelLeftOpen, ShoppingBag, Bike, MapPin } from 'lucide-react';
import Spinner from '../../components/Spinner/Spinner';

function getTableStatus(table, allOrders) {
  const order = allOrders?.find(
    (o) => o.tableId === table.id && (o.status === 'OPEN' || o.status === 'SENT' || o.status === 'SERVED')
  );
  if (!order) return 'free';
  if (order.status === 'SERVED') return 'served';
  if (order.status === 'SENT') return 'sent';
  return 'open';
}

const FILTERS = [
  { id: 'ALL',    label: 'الكل' },
  { id: 'free',   label: 'متاحة' },
  { id: 'open',   label: 'مفتوحة' },
  { id: 'sent',   label: 'في المطبخ' },
  { id: 'served', label: 'نزلها طلب' },
];

/**
 * Compact table selector. ~40 tables would eat the whole screen as a grid, so
 * the panel stays narrow, the tiles are small, and it can be collapsed
 * entirely once the cashier has picked a table. Table numbering, statuses and
 * all backend behaviour are unchanged.
 */
export default function TableGrid({
  tables,
  orders = [],
  activeTable,
  activeOrder,
  loading,
  collapsed,
  onToggleCollapse,
  onTableClick,
  onTakeawayClick,
  onNewTakeawayClick,
  onCloseShift,
}) {
  const [activeTab, setActiveTab] = useState('DINE_IN');
  const [filter, setFilter] = useState('ALL');
  const [jump, setJump] = useState('');
  const [customerSearch, setCustomerSearch] = useState('');

  const takeawayOrders = orders.filter(
    (o) => o.type === 'TAKEAWAY' && o.status !== 'CLOSED' && o.status !== 'VOIDED'
  );

  const visibleTakeaway = useMemo(() => {
    const q = customerSearch.trim().toLowerCase();
    if (!q) return takeawayOrders;
    return takeawayOrders.filter(
      (o) =>
        (o.customerName ?? '').toLowerCase().includes(q) ||
        (o.customerPhone ?? '').includes(q) ||
        String(o.orderNumber ?? '').includes(q)
    );
  }, [takeawayOrders, customerSearch]);

  const sortedTables = useMemo(
    () => [...tables].sort((a, b) => a.number - b.number),
    [tables]
  );

  const counts = useMemo(() => {
    const c = { ALL: sortedTables.length, free: 0, open: 0, sent: 0, served: 0 };
    sortedTables.forEach((t) => { c[getTableStatus(t, orders)] += 1; });
    return c;
  }, [sortedTables, orders]);

  if (collapsed) {
    return (
      <aside className="pos__tables pos__tables--collapsed">
        <button
          type="button"
          className="pos__tables-toggle"
          onClick={onToggleCollapse}
          title="إظهار الترابيزات"
          aria-label="إظهار الترابيزات"
        >
          <PanelLeftOpen size={16} />
        </button>
        <span className="pos__tables-collapsed-label">
          {activeTable ? `ترابيزة ${activeTable.number}` : 'الترابيزات'}
        </span>
        <button
          type="button"
          className="pos__tables-toggle"
          onClick={onCloseShift}
          title="قفل الشيفت"
          aria-label="قفل الشيفت"
        >
          <Lock size={15} />
        </button>
      </aside>
    );
  }

  if (loading) {
    return (
      <aside className="pos__tables">
        <div className="pos__panel-header">الترابيزات</div>
        <div className="pos__loading"><Spinner /></div>
      </aside>
    );
  }

  return (
    <aside className="pos__tables">
      <div className="pos__panel-header pos__tables-header">
        <div className="pos__tables-tabs">
          <button
            type="button"
            className={`pos__tables-tab ${activeTab === 'DINE_IN' ? 'pos__tables-tab--active' : ''}`}
            onClick={() => setActiveTab('DINE_IN')}
          >
            ترابيزات
          </button>
          <button
            type="button"
            className={`pos__tables-tab ${activeTab === 'TAKEAWAY' ? 'pos__tables-tab--active' : ''}`}
            onClick={() => setActiveTab('TAKEAWAY')}
          >
            تيك أواي
            {takeawayOrders.length > 0 && (
              <span className="pos__tables-tab-count">{takeawayOrders.length}</span>
            )}
          </button>
        </div>
        <button
          type="button"
          className="pos__tables-toggle"
          onClick={onToggleCollapse}
          title="إخفاء الترابيزات"
          aria-label="إخفاء الترابيزات"
        >
          <PanelLeftClose size={16} />
        </button>
      </div>

      {activeTab === 'DINE_IN' ? (
        <>
          {/* Quick jump: with ~40 tables, typing the number beats hunting for it */}
          <input
            type="text"
            inputMode="numeric"
            className="table-jump"
            placeholder="رقم الترابيزة…"
            value={jump}
            onChange={(e) => setJump(e.target.value.replace(/[^\d]/g, ''))}
            onKeyDown={(e) => {
              if (e.key === 'Escape') { setJump(''); e.currentTarget.blur(); return; }
              if (e.key !== 'Enter') return;
              e.preventDefault();
              const match = sortedTables.find((t) => String(t.number) === jump);
              if (match) { onTableClick(match); setJump(''); }
            }}
          />

          <div className="table-legend">
            {FILTERS.map((f) => (
              <button
                key={f.id}
                type="button"
                className={`table-legend__item table-legend__item--${f.id === 'ALL' ? 'all' : f.id} ${
                  filter === f.id ? 'table-legend__item--active-filter' : ''
                }`}
                onClick={() => setFilter(f.id)}
              >
                {f.label}
                <span className="table-legend__count">{counts[f.id] ?? 0}</span>
              </button>
            ))}
          </div>

          <div className="table-grid">
            {sortedTables.length === 0 ? (
              <p className="pos__empty">مفيش ترابيزات.</p>
            ) : (
              sortedTables.map((table) => {
                const tableOrder = orders?.find(
                  (o) => o.tableId === table.id && (o.status === 'OPEN' || o.status === 'SENT' || o.status === 'SERVED')
                );
                const status = !tableOrder ? 'free' : tableOrder.status === 'SERVED' ? 'served' : tableOrder.status === 'SENT' ? 'sent' : 'open';
                if (filter !== 'ALL' && status !== filter) return null;
                if (jump && !String(table.number).startsWith(jump)) return null;
                const isActive = activeTable?.id === table.id;
                return (
                  <button
                    key={table.id}
                    type="button"
                    className={`table-btn table-btn--${status} ${isActive ? 'table-btn--active' : ''}`}
                    onClick={() => onTableClick(table)}
                    title={`ترابيزة ${table.number} ${tableOrder ? `(إجمالي: ${tableOrder.total} ج.م)` : '(فاضية)'}`}
                  >
                    <span className={`table-btn__status-dot table-btn__status-dot--${status}`} />
                    <span className="table-btn__title">{table.number}</span>
                    {tableOrder && parseFloat(tableOrder.total) > 0 ? (
                      <span className="table-btn__total">{Math.round(tableOrder.total)}ج</span>
                    ) : table.capacity ? (
                      <span className="table-btn__cap">👥{table.capacity}</span>
                    ) : null}
                  </button>
                );
              })
            )}
          </div>
        </>
      ) : (
        <div className="takeaway-list">
          <button type="button" className="btn btn--primary takeaway-list__new" onClick={onNewTakeawayClick} style={{ gap: '6px' }}>
            <ShoppingBag size={13} /> + تيك أواي / دليفري
          </button>

          {/* Recall a parked order by customer name or phone */}
          {takeawayOrders.length > 2 && (
            <input
              type="text"
              className="table-jump takeaway-list__search"
              placeholder="بحث بالاسم، الموبايل، أو العنوان…"
              value={customerSearch}
              onChange={(e) => setCustomerSearch(e.target.value)}
            />
          )}

          {visibleTakeaway.length === 0 ? (
            <p className="pos__empty">
              {customerSearch ? 'مفيش أوردر بالبحث ده.' : 'مفيش أوردرات تيك أواي أو دليفري.'}
            </p>
          ) : (
            visibleTakeaway.map((order) => {
              const isActive = activeOrder?.id === order.id;
              const isDelivery = Boolean(order.customerAddress || order.deliveryFee > 0);
              let statusText = 'مفتوح';
              let statusColor = 'var(--text-secondary)';
              if (order.status === 'SENT') { statusText = 'في المطبخ'; statusColor = 'var(--warning)'; }
              if (order.status === 'READY_FOR_PICKUP') { statusText = 'جاهز'; statusColor = 'var(--success)'; }

              return (
                <button
                  key={order.id}
                  type="button"
                  className={`takeaway-card ${isActive ? 'takeaway-card--active' : ''}`}
                  onClick={() => onTakeawayClick(order)}
                >
                  <span className="takeaway-card__row">
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      {isDelivery ? <Bike size={13} style={{ color: '#8b5cf6' }} /> : <ShoppingBag size={13} style={{ color: 'var(--accent)' }} />}
                      <strong>#{order.orderNumber}</strong>
                    </span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      {parseFloat(order.total) > 0 && (
                        <strong style={{ color: 'var(--accent-hover)', fontFamily: 'var(--font-mono)' }}>{Math.round(order.total)}ج</strong>
                      )}
                      <span style={{ color: statusColor, fontSize: '10px' }}>{statusText}</span>
                    </span>
                  </span>
                  <span className="takeaway-card__customer" style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>{order.customerName || 'تيك أواي'}</span>
                    {order.customerPhone && <span style={{ fontFamily: 'var(--font-mono)', opacity: 0.7 }}>{order.customerPhone}</span>}
                  </span>
                  {order.customerAddress && (
                    <span style={{ fontSize: '9.5px', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      📍 {order.customerAddress}
                    </span>
                  )}
                </button>
              );
            })
          )}
        </div>
      )}

      <button type="button" className="pos__tables-shift-btn" onClick={onCloseShift}>
        <Lock size={14} /> قفل الشيفت
      </button>
    </aside>
  );
}
