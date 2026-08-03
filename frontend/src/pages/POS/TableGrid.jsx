import { useState } from 'react';
import { Lock } from 'lucide-react';
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

export default function TableGrid({ 
  tables, 
  orders = [], 
  activeTable, 
  activeOrder, 
  loading, 
  onTableClick, 
  onTakeawayClick, 
  onNewTakeawayClick, 
  onCloseShift 
}) {
  const [activeTab, setActiveTab] = useState('DINE_IN'); // DINE_IN or TAKEAWAY
  const [filter, setFilter] = useState('ALL'); // 'ALL', 'free', 'open', 'sent'

  const takeawayOrders = orders.filter(o => o.type === 'TAKEAWAY' && o.status !== 'CLOSED' && o.status !== 'VOID');
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
      <div className="pos__panel-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div className="pos__panel-tabs" style={{ display: 'flex', gap: '8px' }}>
          <button 
            className={`btn btn--sm ${activeTab === 'DINE_IN' ? 'btn--primary' : 'btn--secondary'}`}
            onClick={() => setActiveTab('DINE_IN')}
            style={{ padding: '4px 12px' }}
          >
            الترابيزات
          </button>
          <button 
            className={`btn btn--sm ${activeTab === 'TAKEAWAY' ? 'btn--primary' : 'btn--secondary'}`}
            onClick={() => setActiveTab('TAKEAWAY')}
            style={{ padding: '4px 12px' }}
          >
            تيك أواي
            {takeawayOrders.length > 0 && (
              <span style={{ marginLeft: '4px', background: 'rgba(255,255,255,0.2)', padding: '0 6px', borderRadius: '12px' }}>
                {takeawayOrders.length}
              </span>
            )}
          </button>
        </div>
        <button 
          className="btn btn--secondary btn--sm" 
          onClick={onCloseShift} 
          title="قفل الشيفت"
          style={{ padding: '4px 8px', gap: '4px', display: 'flex', alignItems: 'center' }}
        >
          <Lock size={14} /> قفل الشيفت
        </button>
      </div>

      {activeTab === 'DINE_IN' ? (
        <>
          {/* Legend / Filter */}
          <div className="table-legend">
            <button 
              className={`table-legend__item ${filter === 'ALL' ? 'table-legend__item--active' : ''}`}
              onClick={() => setFilter('ALL')}
            >
              الكل
            </button>
            <button 
              className={`table-legend__item table-legend__item--free ${filter === 'free' ? 'table-legend__item--active-filter' : ''}`}
              onClick={() => setFilter('free')}
            >
              فاضية
            </button>
            <button 
              className={`table-legend__item table-legend__item--open ${filter === 'open' ? 'table-legend__item--active-filter' : ''}`}
              onClick={() => setFilter('open')}
            >
              مفتوحة
            </button>
            <button 
              className={`table-legend__item table-legend__item--served ${filter === 'served' ? 'table-legend__item--active-filter' : ''}`}
              onClick={() => setFilter('served')}
            >
              نزلها طلب
            </button>
          </div>

          {/* Grid */}
          <div className="table-grid">
            {tables.length === 0 ? (
              <p className="pos__empty">مفيش ترابيزات.</p>
            ) : (
              tables
                .sort((a, b) => a.number - b.number)
                .map((table) => {
                  const status   = getTableStatus(table, orders);
                  if (filter !== 'ALL' && status !== filter) return null;
                  const isActive = activeTable?.id === table.id;
                  return (
                    <button
                      key={table.id}
                      className={`table-btn table-btn--${status} ${isActive ? 'table-btn--active' : ''}`}
                      onClick={() => onTableClick(table)}
                      title={`ترابيزة ${table.number} — ${status}`}
                    >
                      <div className={`table-btn__status-dot table-btn__status-dot--${status}`} />
                      <span className="table-btn__title">طاولة {table.number}</span>
                      {table.capacity && (
                        <span className="table-btn__cap">👥 {table.capacity}</span>
                      )}
                    </button>
                  );
                })
            )}
          </div>
        </>
      ) : (
        <div className="takeaway-list" style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '16px' }}>
          <button 
            className="btn btn--primary" 
            style={{ width: '100%', marginBottom: '16px', padding: '12px', fontSize: '16px' }}
            onClick={onNewTakeawayClick}
          >
            + أوردر تيك أواي جديد
          </button>

          {takeawayOrders.length === 0 ? (
            <p className="pos__empty">مفيش أوردرات تيك أواي حالياً.</p>
          ) : (
            takeawayOrders.map(order => {
              const isActive = activeOrder?.id === order.id;
              let statusText = 'مفتوح';
              let statusColor = 'var(--text-primary)';
              if (order.status === 'SENT') { statusText = 'في المطبخ'; statusColor = 'var(--warning)'; }
              if (order.status === 'READY_FOR_PICKUP') { statusText = 'جاهز'; statusColor = 'var(--success)'; }

              return (
                <button
                  key={order.id}
                  className={`table-btn ${isActive ? 'table-btn--active' : ''}`}
                  style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', padding: '12px', height: 'auto' }}
                  onClick={() => onTakeawayClick(order)}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', marginBottom: '8px' }}>
                    <strong>#{order.orderNumber}</strong>
                    <span style={{ color: statusColor, fontSize: '12px', fontWeight: 'bold' }}>{statusText}</span>
                  </div>
                  <div style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>
                    العميل: {order.customerName || 'غير مسجل'}
                  </div>
                  {order.pickupAt && (
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                      الاستلام: {new Date(order.pickupAt).toLocaleTimeString('ar-EG', {hour: '2-digit', minute:'2-digit'})}
                    </div>
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
