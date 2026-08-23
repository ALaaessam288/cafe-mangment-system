import { useState, useMemo, useEffect, useRef } from 'react';
import { Send, CreditCard, XCircle, Users, Utensils, Coffee, Droplet, Bike, Plus, Minus, Undo2, Printer, Tag, Sparkles, Trash2, Edit3, ShoppingBag, MapPin, Phone } from 'lucide-react';
import Spinner from '../../components/Spinner/Spinner';
import Badge from '../../components/Badge/Badge';
import DiscountServiceModal from '../../components/DiscountServiceModal/DiscountServiceModal';
import { formatCurrency } from '../../utils/formatters';
import {
  ACTIONS,
  NEXT_STEP,
  itemStatusLabel,
  itemStatusVariant,
  serveAction,
  serveNextStep,
} from '../../utils/labels';


export default function OrderPanel({
  table,
  order,
  loading,
  onSend,
  onServe,
  onCancelItem,
  onRemoveItem,
  onPayClick,
  onAddWater,
  onMoveTable,
  onCancelOrder,
  onSetDeliveryFee,
  onApplyDiscount,
  onClearDiscount,
  onApplyServiceFee,
  onClearServiceFee,
  onIncreaseItem,
  syncing,
  canUndo,
  onUndoLastItem,
  onReprintTickets,
}) {
  const [cancelItemId, setCancelItemId] = useState(null);
  const [showDiscountModal, setShowDiscountModal] = useState(false);
  const [discountModalInitialTab, setDiscountModalInitialTab] = useState('discount');

  const [deliveryFeeInput, setDeliveryFeeInput] = useState('');
  const deliveryInputRef = useRef(null);

  useEffect(() => {
    // Only sync from order prop if user is not currently typing in the input
    if (document.activeElement !== deliveryInputRef.current) {
      setDeliveryFeeInput(order?.deliveryFee && parseFloat(order.deliveryFee) > 0 ? String(order.deliveryFee) : '');
    }
  }, [order?.id, order?.deliveryFee]);

  function submitDeliveryFee(overrideVal) {
    const rawVal = overrideVal !== undefined ? overrideVal : deliveryFeeInput;
    const amount = parseFloat(rawVal);
    const validAmount = isNaN(amount) || amount < 0 ? 0 : amount;
    onSetDeliveryFee(validAmount);
  }

  async function submitCancel() {
    await onCancelItem(cancelItemId, 'إلغاء');
    setCancelItemId(null);
  }

  // Calculate Food vs Drinks/Buffet Totals
  const { foodTotal, buffetTotal } = useMemo(() => {
    if (!order?.items) return { foodTotal: 0, buffetTotal: 0 };
    let fTotal = 0;
    let bTotal = 0;
    order.items.forEach(item => {
      if (item.status === 'CANCELLED') return;
      const isFood = item.revenueLineSnapshot === 'FOOD' || item.stationSnapshot === 'KITCHEN';
      if (isFood) {
        fTotal += item.lineTotal;
      } else {
        bTotal += item.lineTotal;
      }
    });
    return { foodTotal: fTotal, buffetTotal: bTotal };
  }, [order?.items]);

  const hasWater = useMemo(() => {
    return order?.items?.some(item => {
      if (item.status === 'CANCELLED') return false;
      const n = (item.productNameSnapshot || '').toLowerCase();
      return n.includes('مياه') || n.includes('water') || n.includes('Ù…ÙŠØ§Ù‡');
    });
  }, [order?.items]);

  const hasNewItems = order?.items?.some(item => item.status === 'NEW' || item.status === 'PENDING');
  const showSendBtn = order?.status === 'OPEN' || ((order?.status === 'SENT' || order?.status === 'SERVED') && hasNewItems);
  const disableSendBtn = !order?.items?.length || !hasNewItems;

  const isDelivery = order?.type === 'TAKEAWAY' && Boolean(order.customerAddress || order.deliveryFee > 0);

  return (
    <aside className="pos__order">
      <div className="pos__panel-header" style={{ height: order?.customerAddress ? 'auto' : undefined, minHeight: '40px', padding: '6px 10px' }}>
        {order?.type === 'TAKEAWAY' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', width: '100%', lineHeight: 1.2 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 'bold' }}>
                {isDelivery ? <Bike size={13} style={{ color: '#8b5cf6' }} /> : <ShoppingBag size={13} style={{ color: 'var(--accent)' }} />}
                <span>{isDelivery ? 'دليفري' : 'تيك أواي'}: {order.customerName || 'تيك أواي'}</span>
              </span>
              {order.customerPhone && (
                <span style={{ fontSize: '11px', color: 'var(--accent-hover)', fontFamily: 'var(--font-mono)' }}>
                  {order.customerPhone}
                </span>
              )}
            </div>
            {order.customerAddress && (
              <div style={{ fontSize: '10.5px', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '3px', marginTop: '2px' }}>
                <MapPin size={11} style={{ color: '#8b5cf6', flexShrink: 0 }} />
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{order.customerAddress}</span>
              </div>
            )}
          </div>
        ) : table ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>ترابيزة {table.number}</span>
            {order && onMoveTable && (
              <button 
                className="btn btn--secondary btn--sm" 
                onClick={onMoveTable}
                title="نقل / دمج الطاولة"
                style={{ padding: '4px 8px', fontSize: '11px' }}
              >
                نقل / دمج
              </button>
            )}
          </div>
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
        /* Nothing picked yet. One instruction, pointing at the one place to look - the table
           grid is on the right in this RTL layout. */
        <div className="pos__empty pos__empty--start">
          <div className="pos__empty-title">ابدأ من الترابيزات</div>
          <div className="pos__empty-hint">
            اختار ترابيزة من على اليمين، أو دوس «تيك أواي» لأوردر خارجي.
          </div>
        </div>
      ) : !order ? (
        /* A table is selected but has no order. Previously this said "دوس على منتج عشان تفتح
           أوردر" right after the other message said "اختار ترابيزة أو أوردر عشان تبدأ" - two
           different instructions for what is really one continuous flow. */
        <div className="pos__empty pos__empty--start">
          <div className="pos__empty-title">
            {table ? `ترابيزة ${table.number} فاضية` : 'الترابيزة فاضية'}
          </div>
          <div className="pos__empty-hint">
            دوس على أي صنف من المنيو والأوردر هيتفتح لوحده.
          </div>
        </div>
      ) : (
        <>
          {/* Item list separated by Kitchen vs Bar */}
          <div className="order-items">
            {order.items?.length === 0 ? (
              <div className="pos__empty">مفيش أصناف لسه.</div>
            ) : (
              (() => {
                // Group items
                const groupedFood = [];
                const groupedBuffet = [];

                order.items.forEach(item => {
                  const isFood = item.revenueLineSnapshot === 'FOOD' || item.stationSnapshot === 'KITCHEN';
                  const targetArr = isFood ? groupedFood : groupedBuffet;

                  const existing = targetArr.find(g => 
                    g.productNameSnapshot === item.productNameSnapshot &&
                    (g.status === item.status || ((g.status === 'NEW' || g.status === 'PENDING') && (item.status === 'NEW' || item.status === 'PENDING'))) &&
                    (g.note || '') === (item.note || '') &&
                    (g.cancelReason || '') === (item.cancelReason || '') &&
                    Math.abs(parseFloat(g.unitPriceSnapshot || 0) - parseFloat(item.unitPriceSnapshot || 0)) < 0.01
                  );
                  const lineTotalNum = parseFloat(item.lineTotal !== undefined ? item.lineTotal : (item.unitPriceSnapshot * item.quantity)) || 0;
                  if (existing) {
                    existing.displayQty += item.quantity;
                    existing.displayTotal += lineTotalNum;
                    existing.ids.push(item.id);
                  } else {
                    targetArr.push({
                      ...item,
                      displayQty: item.quantity,
                      displayTotal: lineTotalNum,
                      ids: [item.id]
                    });
                  }
                });

                const renderItem = (group, idx) => {
                  const editable =
                    group.status !== 'CANCELLED' && !['CLOSED', 'VOIDED'].includes(order.status);
                  // Optimistic rows carry a string id until the server confirms them.
                  const pendingSync = group.ids.some((id) => typeof id === 'string');
                  // NEW = saved on the server but not yet sent to a station. PENDING is the
                  // client-side label for a row still in flight, which counts as unsent too.
                  const isUnsent = group.status === 'NEW' || group.status === 'PENDING';
                  return (
                  <div
                    key={group.ids[0] + '-' + idx}
                    className={`order-item order-item--${group.status.toLowerCase()} ${
                      pendingSync ? 'order-item--syncing' : ''
                    }`}
                  >
                    <div className="order-item__info">
                      <div className="order-item__name">{group.productNameSnapshot}</div>
                      <div className="order-item__meta">
                        <Badge variant={itemStatusVariant(group.status)} size="sm">
                          {itemStatusLabel(group.status)}
                        </Badge>
                        <span className="order-item__unit">
                          {formatCurrency(group.unitPriceSnapshot)} × {group.displayQty}
                        </span>
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
                      {editable && (
                        <div className="order-item__qty-controls">
                          {!pendingSync && (
                            <button
                              type="button"
                              className="order-item__qty-btn"
                              title={isUnsent ? 'شيل 1 من الصنف ده' : 'إلغاء 1 من هذا الصنف'}
                              aria-label={isUnsent ? 'شيل 1 من الصنف ده' : 'إلغاء 1 من هذا الصنف'}
                              onClick={() => {
                                const targetId = group.ids[group.ids.length - 1];
                                // Nothing has reached the kitchen yet: just take the line off the
                                // bill. Only a line the cooks have already seen is worth a
                                // confirmation dialog and a permanent cancellation record.
                                if (isUnsent && onRemoveItem) onRemoveItem(targetId);
                                else setCancelItemId(targetId);
                              }}
                            >
                              <Minus size={10} />
                            </button>
                          )}
                          <span className="order-item__qty">{group.displayQty}</span>
                          {onIncreaseItem && (
                            <button
                              type="button"
                              className="order-item__qty-btn order-item__qty-btn--add"
                              title="زيادة 1"
                              aria-label="زيادة الكمية"
                              onClick={() => onIncreaseItem(group)}
                            >
                              <Plus size={10} />
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                  );
                };

                return (
                  <>
                    {/* Food Items Section */}
                    {groupedFood.length > 0 && (
                      <div className="order-items-section">
                        <div className="order-items-section__title order-items-section__title--food">
                          <Utensils size={13} />
                          <span>أصناف المطبخ / الأكل ({formatCurrency(foodTotal)})</span>
                        </div>
                        {groupedFood.map(renderItem)}
                      </div>
                    )}

                    {/* Buffet / Drink Items Section */}
                    {groupedBuffet.length > 0 && (
                      <div className="order-items-section">
                        <div className="order-items-section__title order-items-section__title--drink">
                          <Coffee size={13} />
                          <span>أصناف البار / المشروبات ({formatCurrency(buffetTotal)})</span>
                        </div>
                        {groupedBuffet.map(renderItem)}
                      </div>
                    )}
                  </>
                );
              })()
            )}
          </div>

          {/* Totals with Food vs Drink Breakdown */}
          <div className="order-totals">
            {/* Quick Add Water - always one tap away. Highlighted while the order
                still has no water line, quieter once it does. */}
            <button
              type="button"
              className={`water-chip ${hasWater ? 'water-chip--muted' : ''}`}
              onClick={onAddWater}
              title="إضافة مياه للأوردر"
            >
              <Droplet size={12} />
              <span>{hasWater ? 'مياه زيادة' : 'إضافة مياه'}</span>
            </button>

            {/* Delivery fee - takeaway only.
                The order type check was missing, so a fee input plus five preset buttons rendered
                on every dine-in order too: noise above the actual next-step button, on roughly
                nine out of ten orders, for a charge that cannot apply to a customer sitting at a
                table. Order.deliveryFee is documented takeaway-only on the entity as well. */}
            {order.type === 'TAKEAWAY' && !['CLOSED', 'VOIDED'].includes(order.status) && (
              <div style={{ background: 'var(--bg-secondary)', padding: '10px 12px', borderRadius: '8px', marginBottom: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                  <Bike size={18} style={{ color: '#8b5cf6', flexShrink: 0 }} />
                  <input
                    ref={deliveryInputRef}
                    type="number"
                    min="0"
                    step="0.5"
                    placeholder="رسوم التوصيل"
                    value={deliveryFeeInput}
                    onChange={(e) => setDeliveryFeeInput(e.target.value)}
                    onFocus={(e) => e.target.select()}
                    onBlur={() => submitDeliveryFee()}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); submitDeliveryFee(); } }}
                    className="input"
                    style={{ flex: 1, height: '32px', fontSize: '13px' }}
                  />
                  <button className="btn btn--secondary btn--sm" onClick={() => submitDeliveryFee()} style={{ flexShrink: 0 }}>
                    تطبيق
                  </button>
                </div>
                {/* Quick Delivery Presets */}
                <div style={{ display: 'flex', gap: '4px', justifyContent: 'flex-end' }}>
                  {[10, 15, 20, 25, 30].map((amt) => (
                    <button
                      key={amt}
                      type="button"
                      style={{
                        padding: '2px 8px',
                        fontSize: '11px',
                        borderRadius: '4px',
                        border: '1px solid var(--border-color)',
                        background: parseFloat(deliveryFeeInput) === amt ? '#8b5cf6' : 'var(--bg-surface)',
                        color: parseFloat(deliveryFeeInput) === amt ? '#fff' : 'var(--text-primary)',
                        cursor: 'pointer',
                        fontWeight: '600',
                      }}
                      onClick={() => {
                        setDeliveryFeeInput(String(amt));
                        submitDeliveryFee(amt);
                      }}
                    >
                      {amt} ج.م
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Quick Discount and Service Fee Bar */}
            {!['CLOSED', 'VOIDED'].includes(order.status) && (
              <div style={{ display: 'flex', gap: '6px', marginBottom: '8px' }}>
                <button
                  type="button"
                  className="btn btn--secondary btn--sm"
                  style={{ flex: 1, fontSize: '11.5px', padding: '4px 6px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}
                  onClick={() => { setDiscountModalInitialTab('discount'); setShowDiscountModal(true); }}
                >
                  <Tag size={12} /> {parseFloat(order.discount) > 0 ? `خصم: -${formatCurrency(order.discount)}` : '+ إضافة خصم'}
                </button>

                <button
                  type="button"
                  className="btn btn--secondary btn--sm"
                  style={{ flex: 1, fontSize: '11.5px', padding: '4px 6px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}
                  onClick={() => { setDiscountModalInitialTab('service'); setShowDiscountModal(true); }}
                >
                  <Sparkles size={12} /> {parseFloat(order.service) > 0 ? `خدمة: +${formatCurrency(order.service)}` : '+ رسوم خدمة'}
                </button>
              </div>
            )}

            <div className="order-totals__row">
              <span>المجموع الفرعي</span>
              <span>{formatCurrency(order.subtotal)}</span>
            </div>
            {parseFloat(order.discount) > 0 && (
              <div className="order-totals__row order-totals__row--discount" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span>خصم</span>
                  {!['CLOSED', 'VOIDED'].includes(order.status) && onClearDiscount && (
                    <button
                      type="button"
                      style={{ background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer', padding: 0, display: 'flex' }}
                      onClick={onClearDiscount}
                      title="إلغاء الخصم"
                    >
                      <Trash2 size={12} />
                    </button>
                  )}
                </span>
                <span>-{formatCurrency(order.discount)}</span>
              </div>
            )}
            {parseFloat(order.service) > 0 && (
              <div className="order-totals__row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span>خدمة</span>
                  {!['CLOSED', 'VOIDED'].includes(order.status) && onClearServiceFee && (
                    <button
                      type="button"
                      style={{ background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer', padding: 0, display: 'flex' }}
                      onClick={onClearServiceFee}
                      title="إلغاء الخدمة"
                    >
                      <Trash2 size={12} />
                    </button>
                  )}
                </span>
                <span>+{formatCurrency(order.service)}</span>
              </div>
            )}
            {parseFloat(order.deliveryFee) > 0 && (
              <div className="order-totals__row">
                <span>رسوم التوصيل</span>
                <span>+{formatCurrency(order.deliveryFee)}</span>
              </div>
            )}
            <div className="order-totals__row order-totals__row--total">
              <span>الإجمالي الكلي</span>
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

            {/* Partial payment at a glance */}
            {parseFloat(order.amountPaid) > 0 && parseFloat(order.balanceDue) > 0 && (
              <div className="order-totals__progress" title="نسبة المحصَّل من الفاتورة">
                <div
                  className="order-totals__progress-fill"
                  style={{
                    width: `${Math.min(100, Math.round((parseFloat(order.amountPaid) / (parseFloat(order.total) || 1)) * 100))}%`,
                  }}
                />
              </div>
            )}
          </div>

          {/* Actions.
              Pinned to the bottom of the panel. Everything above it - the item list, the delivery
              box, eight rows of totals - can grow without limit, and on a busy order the one
              button the cashier needs next used to scroll out of sight entirely. */}
          <div className="order-actions order-actions--sticky">
            {(() => {
              const canServe = order.status === 'SENT' && !hasNewItems;
              const canPay = ['OPEN', 'SENT', 'SERVED', 'READY_FOR_PICKUP'].includes(order.status) && parseFloat(order.balanceDue) > 0;
              // Only one of these is ever the actual next step - whichever comes first in the
              // real workflow (send to kitchen, then serve, then collect payment). Any other
              // action that's still technically valid (e.g. a balance due while items are still
              // unsent) stays available but demoted, instead of competing for attention.
              const primary = showSendBtn ? 'SEND' : canServe ? 'SERVE' : canPay ? 'PAY' : null;

              const nextStepLabel =
                primary === 'SEND' ? NEXT_STEP.SEND
                : primary === 'SERVE' ? serveNextStep(order.type)
                : primary === 'PAY' ? NEXT_STEP.PAY
                : null;

              return (
                <>
                  {nextStepLabel && <div className="order-actions__hint">{nextStepLabel}</div>}

                  {canUndo && (
                    <button
                      type="button"
                      className="btn btn--ghost btn--sm order-actions__btn order-actions__undo"
                      onClick={onUndoLastItem}
                      title="تراجع عن آخر صنف (Ctrl+Z)"
                    >
                      <Undo2 size={14} /> تراجع عن آخر صنف
                    </button>
                  )}

                  {showSendBtn && (
                    <button
                      className={`btn order-actions__btn ${primary === 'SEND' ? 'btn--primary btn--lg order-actions__btn--primary' : 'btn--ghost btn--sm'}`}
                      onClick={onSend}
                      disabled={disableSendBtn || syncing}
                      title={disableSendBtn ? 'مفيش أصناف جديدة لإرسالها' : syncing ? 'لسه في صنف بيتسجل…' : ''}
                    >
                      <Send size={primary === 'SEND' ? 18 : 14} /> {ACTIONS.SEND}
                      <kbd className="order-actions__kbd">F4</kbd>
                    </button>
                  )}

                  {canServe && (
                    <button
                      className={`btn order-actions__btn ${primary === 'SERVE' ? 'btn--success btn--lg order-actions__btn--primary' : 'btn--ghost btn--sm'}`}
                      onClick={onServe}
                      disabled={syncing}
                    >
                      <Users size={primary === 'SERVE' ? 18 : 14} /> {serveAction(order.type)}
                    </button>
                  )}

                  {canPay && (
                    <button
                      className={`btn order-actions__btn ${primary === 'PAY' ? 'btn--success btn--lg order-actions__btn--primary' : 'btn--ghost btn--sm'}`}
                      onClick={onPayClick}
                      disabled={syncing}
                    >
                      <CreditCard size={primary === 'PAY' ? 18 : 14} /> {ACTIONS.PAY}
                      <kbd className="order-actions__kbd">F8</kbd>
                    </button>
                  )}
                </>
              );
            })()}
            {onReprintTickets && order.items?.some((i) => i.status === 'SENT') && (
              <button
                type="button"
                className="btn btn--ghost btn--sm order-actions__btn"
                onClick={onReprintTickets}
                title="إعادة طباعة بون المطبخ / البار"
              >
                <Printer size={14} /> إعادة طباعة البون
              </button>
            )}
            {order && !['CLOSED','VOIDED'].includes(order.status) && (
               <button
                 type="button"
                 className="btn btn--danger btn--sm order-actions__btn"
                 onClick={() => {
                   if (window.confirm('هل أنت متأكد من إلغاء هذا الأوردر بالكامل؟ لا يمكن التراجع عن هذا الإجراء.')) {
                     onCancelOrder();
                   }
                 }}
                 style={{
                   background: 'rgba(239, 68, 68, 0.12)',
                   color: '#ef4444',
                   border: '1px solid rgba(239, 68, 68, 0.35)',
                   marginTop: '8px',
                   width: '100%',
                   justify: 'center',
                   fontWeight: '600'
                 }}
               >
                 <XCircle size={15} /> إلغاء الأوردر بالكامل
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
            {(order.status === 'VOIDED') && (
              <div className="order-void-badge">الأوردر ملغي</div>
            )}
          </div>

          {/* Cancel item dialog */}
          {cancelItemId && (
            <div className="cancel-overlay" onClick={() => setCancelItemId(null)}>
              <div className="cancel-dialog" onClick={(e) => e.stopPropagation()}>
                <h4>تأكيد إلغاء الصنف</h4>
                <p style={{ color: 'var(--text-secondary)', fontSize: '14px', margin: '8px 0 16px' }}>
                  هل أنت متأكد من إلغاء هذا الصنف؟
                </p>
                <div className="cancel-dialog__actions">
                  <button className="btn btn--ghost btn--sm" onClick={() => setCancelItemId(null)}>رجوع</button>
                  <button className="btn btn--danger btn--sm" onClick={submitCancel}>تأكيد الإلغاء</button>
                </div>
              </div>
            </div>
          )}

          {/* Discount & Service Fee Modal */}
          {showDiscountModal && (
            <DiscountServiceModal
              isOpen={showDiscountModal}
              onClose={() => setShowDiscountModal(false)}
              order={order}
              initialTab={discountModalInitialTab}
              onApplyDiscount={(data) => {
                if (onApplyDiscount) onApplyDiscount(data);
              }}
              onClearDiscount={() => {
                if (onClearDiscount) onClearDiscount();
              }}
              onApplyServiceFee={(amount) => {
                if (onApplyServiceFee) onApplyServiceFee(amount);
              }}
              onClearServiceFee={() => {
                if (onClearServiceFee) onClearServiceFee();
              }}
            />
          )}
        </>
      )}
    </aside>
  );
}
