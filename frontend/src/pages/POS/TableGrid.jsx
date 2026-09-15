import { useState, useMemo } from 'react';
import { PanelLeftClose, PanelLeftOpen, ShoppingBag, Bike } from 'lucide-react';
import Spinner from '../../components/Spinner/Spinner';
import { TABLE_STATUS, orderForTable, statusKey, statusWithAge } from './tableStatus';

/* Status, its wording and its timing all come from tableStatus.js now. This file used to carry
   its own three-line version of the same mapping, and the legend below carried a fourth set of
   words again ("نزلها طلب" for what the tiles called SERVED) - so the filter a cashier pressed
   and the tile they were looking for did not read as the same thing. */
const FILTERS = [
  { id: 'ALL',              label: 'الكل' },
  { id: 'free',             label: TABLE_STATUS.free },
  { id: 'open',             label: TABLE_STATUS.open },
  { id: 'sent',             label: TABLE_STATUS.sent },
  { id: 'served',           label: TABLE_STATUS.served },
  { id: 'awaiting_payment', label: TABLE_STATUS.awaiting_payment },
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
    const c = { ALL: sortedTables.length, free: 0, open: 0, sent: 0, served: 0, awaiting_payment: 0 };
    sortedTables.forEach((t) => { c[statusKey(orderForTable(t.id, orders))] += 1; });
    return c;
  }, [sortedTables, orders]);

  if (collapsed) {
    /* The whole rail is the button.
       It used to be a small icon at the top and a vertical label positioned by space-between -
       which, once the close-shift button left this rail, meant the label sat at the very bottom
       of a full-height column, a screen away from the only control that reopened the panel. A
       40px strip with nothing else in it should just be one big target. */
    return (
      <aside className="pos__tables pos__tables--collapsed">
        <button
          type="button"
          className="pos__tables-rail"
          onClick={onToggleCollapse}
          title="إظهار الترابيزات"
          aria-label="إظهار الترابيزات"
        >
          <PanelLeftOpen size={16} />
          <span className="pos__tables-collapsed-label">
            {activeTable ? `ترابيزة ${activeTable.number}` : 'الترابيزات'}
          </span>
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
        <span className="pos__station-number">01</span>
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
                const tableOrder = orderForTable(table.id, orders);
                const status = statusKey(tableOrder);
                if (filter !== 'ALL' && status !== filter) return null;
                if (jump && !String(table.number).startsWith(jump)) return null;
                const isActive = activeTable?.id === table.id;
                const spoken = statusWithAge(tableOrder);
                return (
                  <button
                    key={table.id}
                    type="button"
                    className={`table-btn table-btn--${status} ${isActive ? 'table-btn--active' : ''}`}
                    onClick={() => onTableClick(table)}
                    title={`ترابيزة ${table.number} — ${spoken}${
                      tableOrder && parseFloat(tableOrder.total) > 0 ? ` (${Math.round(tableOrder.total)} ج.م)` : ''
                    }`}
                    aria-label={`ترابيزة ${table.number}، ${spoken}`}
                  >
                    <span className={`table-btn__status-dot table-btn__status-dot--${status}`} />
                    <span className="table-btn__title">{table.number}</span>
                    {/* The dot is decoration; this line is the status. Colour never carries it
                        alone - a legend the cashier has to remember is a legend they will not. */}
                    <span className="table-btn__state">{spoken}</span>
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
              const statusText = statusWithAge(order);
              const key = statusKey(order);
              const statusColor = key === 'sent' ? 'var(--warning)'
                : key === 'served' ? 'var(--success)'
                : key === 'awaiting_payment' ? 'var(--accent-hover)'
                : 'var(--text-secondary)';

              return (
                <button
                  key={order.id}
                  type="button"
                  className={`takeaway-card ${isActive ? 'takeaway-card--active' : ''}`}
                  onClick={() => onTakeawayClick(order)}
                >
                  <span className="takeaway-card__row">
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      {isDelivery ? <Bike size={13} style={{ color: '#8e82eb' }} /> : <ShoppingBag size={13} style={{ color: 'var(--accent)' }} />}
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

    </aside>
  );
}
