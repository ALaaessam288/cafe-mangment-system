import { useState } from 'react';
import { Send, CreditCard, XCircle, Users } from 'lucide-react';
import Spinner from '../../components/Spinner/Spinner';
import Badge from '../../components/Badge/Badge';
import { formatCurrency } from '../../utils/formatters';
import { ROLES } from '../../utils/constants';

function itemStatusVariant(status) {
  const map = { PENDING: 'warning', SENT: 'info', CANCELLED: 'danger' };
  return map[status] ?? 'neutral';
}

function itemStatusTranslation(status) {
  const map = { PENDING: 'قيد الانتظار', SENT: 'تم الإرسال', CANCELLED: 'ملغي' };
  return map[status] ?? status;
}

export default function OrderPanel({ table, order, loading, role, onSend, onServe, onCancelItem, onPayClick }) {
  const [cancelItemId, setCancelItemId] = useState(null);
  const [cancelReason, setCancelReason] = useState('');
  const canCancel = role === ROLES.ADMIN || role === ROLES.SUPERVISOR;

  async function submitCancel() {
    if (!cancelReason.trim()) return;
    await onCancelItem(cancelItemId, cancelReason.trim());
    setCancelItemId(null);
    setCancelReason('');
  }

  const hasNewItems = order?.items?.some(item => item.status === 'NEW' || item.status === 'PENDING');
  const showSendBtn = order?.status === 'OPEN' || ((order?.status === 'SENT' || order?.status === 'SERVED') && hasNewItems);
  const disableSendBtn = !order?.items?.length || !hasNewItems;

  return (
    <aside className="pos__order">
      <div className="pos__panel-header">
        {order?.type === 'TAKEAWAY' ? (
          <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.2 }}>
            <span>تيك أواي: {order.customerName}</span>
            {order.customerPhone && <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{order.customerPhone}</span>}
          </div>
        ) : table ? (
          <span>ترابيزة {table.number}</span>
        ) : (
          <span className="text-muted">اختار ترابيزة أو أوردر</span>
        )}
        {order?.guestCount && (
          <span className="pos__guest-count">
            <Users size={13} /> {order.guestCount}
          </span>
        )}
      </div>

      {loading ? (
        <div className="pos__loading"><Spinner /></div>
      ) : !table && !order ? (
        <div className="pos__empty">اختار ترابيزة أو أوردر عشان تبدأ.</div>
      ) : !order ? (
        <div className="pos__empty">مفيش أوردر مفتوح.<br/>دوس على منتج عشان تفتح أوردر.</div>
      ) : (
        <>
          {/* Item list */}
          <div className="order-items">
            {order.items?.length === 0 ? (
              <div className="pos__empty">مفيش أصناف لسه.</div>
            ) : (
              (() => {
                // Group items
                const grouped = [];
                order.items.forEach(item => {
                  const existing = grouped.find(g => 
                    g.productNameSnapshot === item.productNameSnapshot &&
                    g.status === item.status &&
                    g.note === item.note &&
                    g.cancelReason === item.cancelReason &&
                    g.unitPriceSnapshot === item.unitPriceSnapshot
                  );
                  if (existing) {
                    existing.displayQty += item.quantity;
                    existing.displayTotal += item.lineTotal;
                    existing.ids.push(item.id);
                  } else {
                    grouped.push({
                      ...item,
                      displayQty: item.quantity,
                      displayTotal: item.lineTotal,
                      ids: [item.id]
                    });
                  }
                });

                return grouped.map((group, idx) => (
                  <div
                    key={group.ids[0] + '-' + idx}
                    className={`order-item order-item--${group.status.toLowerCase()}`}
                  >
                    <div className="order-item__info">
                      <div className="order-item__name">{group.productNameSnapshot}</div>
                      <div className="order-item__meta">
                        <Badge variant={itemStatusVariant(group.status)} size="sm">
                          {itemStatusTranslation(group.status)}
                        </Badge>
                        <span className="order-item__qty">×{group.displayQty}</span>
                      </div>
                      {group.note && (
                        <div className="order-item__note">{group.note}</div>
                      )}
                      {group.cancelReason && (
                        <div className="order-item__cancel-reason">✕ {group.cancelReason}</div>
                      )}
                    </div>
                    <div className="order-item__right">
                      <div className="order-item__price">{formatCurrency(group.displayTotal)}</div>
                      {canCancel && group.status !== 'CANCELLED' && (
                        <button
                          className="order-item__cancel-btn"
                          title="إلغاء 1 صنف"
                          onClick={() => setCancelItemId(group.ids[group.ids.length - 1])}
                        >
                          <XCircle size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                ));
              })()
            )}
          </div>

          {/* Totals */}
          <div className="order-totals">
            <div className="order-totals__row">
              <span>المجموع الفرعي</span>
              <span>{formatCurrency(order.subtotal)}</span>
            </div>
            {parseFloat(order.discount) > 0 && (
              <div className="order-totals__row order-totals__row--discount">
                <span>خصم</span>
                <span>-{formatCurrency(order.discount)}</span>
              </div>
            )}
            {parseFloat(order.service) > 0 && (
              <div className="order-totals__row">
                <span>خدمة</span>
                <span>{formatCurrency(order.service)}</span>
              </div>
            )}
            <div className="order-totals__row order-totals__row--total">
              <span>الإجمالي</span>
              <span>{formatCurrency(order.total)}</span>
            </div>
            {parseFloat(order.amountPaid) > 0 && (
              <div className="order-totals__row">
                <span>المدفوع</span>
                <span>{formatCurrency(order.amountPaid)}</span>
              </div>
            )}
            {parseFloat(order.balanceDue) > 0 && (
              <div className="order-totals__row order-totals__row--balance">
                <span>الباقي</span>
                <span>{formatCurrency(order.balanceDue)}</span>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="order-actions">
            {showSendBtn && (
              <button 
                className="btn btn--secondary btn--md order-actions__btn" 
                style={{ 
                  background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)', 
                  color: 'white', 
                  border: 'none',
                  boxShadow: '0 4px 14px rgba(59, 130, 246, 0.3)'
                }}
                onClick={onSend}
                disabled={disableSendBtn}
                title={disableSendBtn ? "مفيش أصناف جديدة لإرسالها" : ""}
              >
                <Send size={16} /> إرسال للمطبخ
              </button>
            )}

            {(order.status === 'SENT' && !hasNewItems) && (
              <button 
                className="btn btn--secondary btn--md order-actions__btn" 
                style={{ 
                  background: 'linear-gradient(135deg, #10b981 0%, #047857 100%)', 
                  color: 'white', 
                  border: 'none',
                  boxShadow: '0 4px 14px rgba(16, 185, 129, 0.3)'
                }}
                onClick={onServe}
              >
                <Users size={16} /> {order.type === 'TAKEAWAY' ? 'جاهز للاستلام' : 'طلع بالأوردر'}
              </button>
            )}

            {(order.status === 'OPEN' || order.status === 'SENT' || order.status === 'SERVED' || order.status === 'READY_FOR_PICKUP') && parseFloat(order.balanceDue) > 0 && (
              <button 
                className="btn btn--secondary btn--md order-actions__btn"
                style={{ 
                  background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)', 
                  color: 'white', 
                  border: 'none',
                  boxShadow: '0 4px 14px rgba(245, 158, 11, 0.3)'
                }}
                onClick={onPayClick}
              >
                <CreditCard size={16} /> دفع الفاتورة
              </button>
            )}
            {(order.status === 'SERVED' || order.status === 'READY_FOR_PICKUP') && parseFloat(order.balanceDue) === 0 && (
              <div className="order-closed-badge" style={{ background: 'var(--success-dim)', color: 'var(--success)' }}>
                ✓ {order.type === 'TAKEAWAY' ? 'العميل استلم' : (order.openedBy?.fullName || 'الكابتن') + ' طلع بالأوردر'}
              </div>
            )}
            {(order.status === 'CLOSED') && (
              <div className="order-closed-badge">الأوردر اتقفل ✓</div>
            )}
            {(order.status === 'VOID') && (
              <div className="order-void-badge">الأوردر ملغي</div>
            )}
          </div>

          {/* Cancel item dialog */}
          {cancelItemId && (
            <div className="cancel-overlay" onClick={() => setCancelItemId(null)}>
              <div className="cancel-dialog" onClick={(e) => e.stopPropagation()}>
                <h4>إلغاء الصنف</h4>
                <input
                  className="cancel-dialog__input"
                  placeholder="سبب الإلغاء..."
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  autoFocus
                  onKeyDown={(e) => e.key === 'Enter' && submitCancel()}
                />
                <div className="cancel-dialog__actions">
                  <button className="btn btn--ghost btn--sm" onClick={() => setCancelItemId(null)}>إلغاء</button>
                  <button className="btn btn--danger btn--sm" onClick={submitCancel}>تأكيد</button>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </aside>
  );
}
