import { useCallback, useEffect, useReducer, useState } from 'react';
import { tablesApi } from '../../api/tablesApi';
import { ordersApi } from '../../api/ordersApi';
import { menuApi }   from '../../api/menuApi';
import { useToast }  from '../../context/ToastContext';
import { useAuth }   from '../../context/AuthContext';
import { registersApi } from '../../api/registersApi';
import { shiftsApi }   from '../../api/shiftsApi';
import TableGrid     from './TableGrid';
import MenuPanel     from './MenuPanel';
import OrderPanel    from './OrderPanel';
import PaymentModal  from './PaymentModal';
import './POSPage.css';

/* ── Reducer ── */
const initialState = {
  tables:        [],
  activeOrders:  [],
  categories:    [],
  products:      [],
  activeTable:   null,  // CafeTableResponse
  activeOrder:   null,  // OrderResponse
  activeShift:   null,  // ShiftResponse
  selectedCategoryId: null,
  isLoadingTables:  false,
  isLoadingOrders:  false,
  isLoadingMenu:    false,
  isLoadingOrder:   false,
};

function reducer(state, action) {
  switch (action.type) {
    case 'SET_TABLES':   return { ...state, tables: action.payload };
    case 'SET_ORDERS':   return { ...state, activeOrders: action.payload };
    case 'SET_CATS':     return { ...state, categories: action.payload };
    case 'SET_PRODUCTS': return { ...state, products: action.payload };
    case 'SET_CAT_ID':   return { ...state, selectedCategoryId: action.payload };
    case 'SELECT_TABLE': return { ...state, activeTable: action.payload, activeOrder: null };
    case 'SELECT_ORDER': return { ...state, activeOrder: action.payload, activeTable: null };
    case 'SET_ORDER':    return { ...state, activeOrder: action.payload };
    case 'SET_SHIFT':    return { ...state, activeShift: action.payload };
    case 'CLEAR_TABLE':  return { ...state, activeTable: null, activeOrder: null };
    case 'LOADING_TABLES': return { ...state, isLoadingTables: action.payload };
    case 'LOADING_ORDERS': return { ...state, isLoadingOrders: action.payload };
    case 'LOADING_MENU':   return { ...state, isLoadingMenu: action.payload };
    case 'LOADING_ORDER':  return { ...state, isLoadingOrder: action.payload };
    default: return state;
  }
}

export default function POSPage() {
  const toast  = useToast();
  const { role, user } = useAuth();

  const [state, dispatch] = useReducer(reducer, initialState);
  const [showPayment, setShowPayment] = useState(false);
  const [openTableModal, setOpenTableModal] = useState(false);
  const [openTakeawayModal, setOpenTakeawayModal] = useState(false);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [kitchenTicket, setKitchenTicket] = useState(null);
  const [clientReceipt, setClientReceipt] = useState(null);
  
  // Shift state
  const [registers, setRegisters] = useState([]);
  const [startShiftForm, setStartShiftForm] = useState({ openingFloat: '', registerId: '' });
  const [isLoadingShift, setIsLoadingShift] = useState(true);
  
  const [showCloseShift, setShowCloseShift] = useState(false);
  const [closeShiftForm, setCloseShiftForm] = useState({ countedCash: '' });

  // POS Options selection state
  const [showPosOptionsModal, setShowPosOptionsModal] = useState(false);
  const [posOptionsProduct, setPosOptionsProduct] = useState(null);
  const [posOptionsList, setPosOptionsList] = useState([]);
  const [selectedOptionIds, setSelectedOptionIds] = useState([]);

  /* ── Load tables ── */
  const loadTables = useCallback(async () => {
    dispatch({ type: 'LOADING_TABLES', payload: true });
    try {
      const data = await tablesApi.findAll();
      dispatch({ type: 'SET_TABLES', payload: data.filter((t) => t.active) });
    } catch (err) {
      toast.error(err.message, 'فشل في تحميل الترابيزات');
    } finally {
      dispatch({ type: 'LOADING_TABLES', payload: false });
    }
  }, [toast]);

  /* ── Load active orders ── */
  const loadOrders = useCallback(async () => {
    dispatch({ type: 'LOADING_ORDERS', payload: true });
    try {
      const data = await ordersApi.findAll();
      dispatch({ type: 'SET_ORDERS', payload: data.filter((o) => o.status === 'OPEN' || o.status === 'SENT' || o.status === 'SERVED') });
    } catch (err) {
      toast.error(err.message, 'فشل في تحميل الأوردرات');
    } finally {
      dispatch({ type: 'LOADING_ORDERS', payload: false });
    }
  }, [toast]);

  /* ── Load menu ── */
  const loadMenu = useCallback(async (catId) => {
    dispatch({ type: 'LOADING_MENU', payload: true });
    try {
      const products = await menuApi.getProducts(catId);
      dispatch({ type: 'SET_PRODUCTS', payload: products.filter((p) => p.active && p.available) });
    } catch (err) {
      toast.error(err.message, 'فشل في تحميل المنتجات');
    } finally {
      dispatch({ type: 'LOADING_MENU', payload: false });
    }
  }, [toast]);

  /* ── Boot ── */
  useEffect(() => {
    async function boot() {
      try {
        const shift = await shiftsApi.myCurrent().catch(() => null);
        dispatch({ type: 'SET_SHIFT', payload: shift });
        setIsLoadingShift(false);

        if (!shift) {
          let reg = await registersApi.findAll();
          
          if (reg.length === 0) {
            // Auto-create a default register if none exists (for quick start)
            try {
              const defaultReg = await registersApi.create({ name: 'الكاشير الرئيسي', code: 'MAIN_REG' });
              reg = [defaultReg];
            } catch (e) {
              console.error('Failed to auto-create register', e);
            }
          }

          const activeReg = reg.filter(r => r.active !== false); // active might be undefined or true
          setRegisters(activeReg);
          if (activeReg.length > 0) setStartShiftForm(prev => ({ ...prev, registerId: activeReg[0].id }));
        }
      } catch (err) {
        setIsLoadingShift(false);
      }
      await loadTables();
      await loadOrders();
      try {
        const cats = await menuApi.getCategories();
        const active = cats.filter((c) => c.active);
        dispatch({ type: 'SET_CATS', payload: active });
        if (active.length > 0) {
          dispatch({ type: 'SET_CAT_ID', payload: active[0].id });
          await loadMenu(active[0].id);
        }
      } catch (err) {
        toast.error(err.message, 'فشل في تحميل الأقسام');
      }
    }
    boot();
  }, [loadTables, loadOrders, loadMenu, toast]);

  /* ── Open Shift ── */
  async function handleOpenShift(e) {
    e.preventDefault();
    if (!startShiftForm.openingFloat || !startShiftForm.registerId) return;
    try {
      const shift = await shiftsApi.open({
        openingFloat: parseFloat(startShiftForm.openingFloat),
        registerId: parseInt(startShiftForm.registerId)
      });
      dispatch({ type: 'SET_SHIFT', payload: shift });
      toast.success('تم فتح الشيفت بنجاح!');
    } catch (err) {
      toast.error(err.message, 'فشل في فتح الشيفت');
    }
  }

  /* ── Close Shift ── */
  async function handleCloseShift(e) {
    e.preventDefault();
    if (!closeShiftForm.countedCash) return;
    try {
      await shiftsApi.close(state.activeShift.id, {
        countedCash: parseFloat(closeShiftForm.countedCash)
      });
      toast.success('تم قفل الشيفت بنجاح!');
      setShowCloseShift(false);
      setCloseShiftForm({ countedCash: '' });
      dispatch({ type: 'SET_SHIFT', payload: null });
      // Reset active orders/tables
      dispatch({ type: 'CLEAR_TABLE' });
    } catch (err) {
      toast.error(err.message, 'فشل في قفل الشيفت');
    }
  }

  /* ── Select category ── */
  async function handleCategorySelect(catId) {
    dispatch({ type: 'SET_CAT_ID', payload: catId });
    await loadMenu(catId);
  }

  /* ── Load order for table ── */
  async function loadOrderForTable(tableId) {
    dispatch({ type: 'LOADING_ORDER', payload: true });
    try {
      const allOrders = await ordersApi.findAll();
      const existing  = allOrders.find(
        (o) => o.tableId === tableId && (o.status === 'OPEN' || o.status === 'SENT' || o.status === 'SERVED')
      );
      if (existing) {
        const full = await ordersApi.findById(existing.id);
        dispatch({ type: 'SET_ORDER', payload: full });
      } else {
        dispatch({ type: 'SET_ORDER', payload: null });
      }
    } catch (err) {
      toast.error(err.message, 'فشل في تحميل الأوردر');
    } finally {
      dispatch({ type: 'LOADING_ORDER', payload: false });
    }
  }

  /* ── Click table ── */
  async function handleTableClick(table) {
    dispatch({ type: 'SELECT_TABLE', payload: table });
    await loadOrderForTable(table.id);
  }

  /* ── Open order ── */
  async function handleOpenOrder() {
    if (!state.activeTable || !state.activeShift) return;
    dispatch({ type: 'LOADING_ORDER', payload: true });
    try {
      const order = await ordersApi.open({
        tableId:    state.activeTable.id,
        type:       'DINE_IN',
        shiftId:    state.activeShift.id,
        userId:     user.id
      });
      dispatch({ type: 'SET_ORDER', payload: order });
      setOpenTableModal(false);
      toast.success(`اتفتح أوردر لترابيزة ${state.activeTable.number}`);
      await loadTables();
      await loadOrders();
    } catch (err) {
      toast.error(err.message, 'فشل في فتح الأوردر');
    } finally {
      dispatch({ type: 'LOADING_ORDER', payload: false });
    }
  }

  /* ── Open Takeaway order ── */
  async function handleOpenTakeawayOrder(e) {
    e.preventDefault();
    if (!customerName.trim() || !state.activeShift) return;
    dispatch({ type: 'LOADING_ORDER', payload: true });
    try {
      const order = await ordersApi.open({
        type:         'TAKEAWAY',
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim() || undefined,
        shiftId:      state.activeShift.id,
        userId:       user.id
      });
      dispatch({ type: 'SELECT_ORDER', payload: order });
      setOpenTakeawayModal(false);
      setCustomerName('');
      setCustomerPhone('');
      toast.success('تم فتح أوردر تيك أواي جديد!');
      await loadOrders();
    } catch (err) {
      toast.error(err.message, 'فشل في فتح الأوردر');
    } finally {
      dispatch({ type: 'LOADING_ORDER', payload: false });
    }
  }

  /* ── Add item ── */
  async function handleAddProduct(product) {
    if (!state.activeOrder) {
      if (state.activeTable) {
        setOpenTableModal(true);
      } else {
        toast.warning('لازم تختار ترابيزة أو تفتح أوردر تيك أواي الأول.');
      }
      return;
    }
    if (state.activeOrder.status === 'CLOSED' || state.activeOrder.status === 'VOID') {
      toast.warning('الأوردر ده مقفول أصلاً.');
      return;
    }
    try {
      const options = await menuApi.getOptions(product.id);
      if (options && options.length > 0) {
        setPosOptionsProduct(product);
        setPosOptionsList(options);
        setSelectedOptionIds(options.filter(o => o.isDefault).map(o => o.id));
        setShowPosOptionsModal(true);
      } else {
        const updated = await ordersApi.addItem(state.activeOrder.id, {
          productId: product.id,
          quantity:  1,
        });
        dispatch({ type: 'SET_ORDER', payload: updated });
      }
    } catch (err) {
      toast.error(err.message, 'فشل في إضافة الصنف');
    }
  }

  async function handleAddProductWithOptions() {
    if (!state.activeOrder || !posOptionsProduct) return;
    try {
      const updated = await ordersApi.addItem(state.activeOrder.id, {
        productId: posOptionsProduct.id,
        quantity:  1,
        optionIds: selectedOptionIds
      });
      dispatch({ type: 'SET_ORDER', payload: updated });
      setShowPosOptionsModal(false);
      setPosOptionsProduct(null);
      setPosOptionsList([]);
      setSelectedOptionIds([]);
    } catch (err) {
      toast.error(err.message, 'فشل في إضافة الصنف بالاختيارات');
    }
  }

  /* ── Send to kitchen ── */
  async function handleSend() {
    if (!state.activeOrder) return;
    dispatch({ type: 'LOADING_ORDER', payload: true });
    try {
      const itemsToSend = state.activeOrder.items?.filter(i => i.status === 'NEW' || i.status === 'PENDING') || [];
      if (itemsToSend.length > 0) {
        
        // Group items for kitchen ticket
        const grouped = [];
        itemsToSend.forEach(item => {
          const existing = grouped.find(g => 
            g.productNameSnapshot === item.productNameSnapshot &&
            g.note === item.note
          );
          if (existing) {
            existing.quantity += item.quantity;
          } else {
            grouped.push({ ...item });
          }
        });

        setKitchenTicket({
          orderNumber: state.activeOrder.orderNumber,
          tableNumber: state.activeTable?.number,
          type: state.activeOrder.type,
          items: grouped,
          time: new Date()
        });
        
        document.body.classList.add('printing-kitchen');
        setTimeout(() => {
          window.print();
          document.body.classList.remove('printing-kitchen');
          setKitchenTicket(null);
        }, 100);
      }

      const updated = await ordersApi.send(state.activeOrder.id);
      dispatch({ type: 'SET_ORDER', payload: updated });
      toast.success('الأوردر اتبعت للمطبخ!');
      await loadOrders();
    } catch (err) {
      toast.error(err.message, 'فشل في إرسال الأوردر');
    } finally {
      dispatch({ type: 'LOADING_ORDER', payload: false });
    }
  }

  /* ── Serve Order ── */
  async function handleServe() {
    if (!state.activeOrder) return;
    dispatch({ type: 'LOADING_ORDER', payload: true });
    try {
      const updated = await ordersApi.serve(state.activeOrder.id);
      dispatch({ type: 'SET_ORDER', payload: updated });
      toast.success('تم خروج الأوردر للترابيزة!');
      await loadOrders();
    } catch (err) {
      toast.error(err.message, 'فشل في تحديث حالة الأوردر');
    } finally {
      dispatch({ type: 'LOADING_ORDER', payload: false });
    }
  }

  /* ── Cancel item ── */
  async function handleCancelItem(itemId, reason) {
    if (!state.activeOrder) return;
    try {
      const updated = await ordersApi.cancelItem(state.activeOrder.id, itemId, { reason });
      dispatch({ type: 'SET_ORDER', payload: updated });
      toast.success('الصنف اتلغى.');
      await loadOrders();
    } catch (err) {
      toast.error(err.message, 'فشل في إلغاء الصنف');
    }
  }

  /* ── Instant Pay ── */
  async function handleInstantPay() {
    if (!state.activeOrder) return;
    try {
      // Auto-send to kitchen first if there are new items
      const hasNewItems = state.activeOrder.items?.some(i => i.status === 'NEW' || i.status === 'PENDING');
      if (hasNewItems) {
        await handleSend(); // this will also print kitchen ticket
      }
      
      // Then open payment modal
      setShowPayment(true);
    } catch (err) {
      toast.error(err.message, 'حصلت مشكلة في الدفع الفوري');
    }
  }

  /* ── After payment closed ── */
  async function handlePaymentSuccess(paymentData) {
    setShowPayment(false);
    toast.success('تم الدفع والأوردر اتقفل!');

    // If it's a takeaway or user wants receipt, print it
    if (state.activeOrder) {
      setClientReceipt({
        ...state.activeOrder,
        time: new Date(),
        paymentAmount: paymentData?.amount || state.activeOrder.total
      });
      
      document.body.classList.add('printing-client');
      setTimeout(() => {
        window.print();
        document.body.classList.remove('printing-client');
        setClientReceipt(null);
      }, 100);
    }

    dispatch({ type: 'CLEAR_TABLE' });
    await loadTables();
    await loadOrders();
  }

  if (isLoadingShift) return <div className="page" style={{display: 'flex', justifyContent: 'center', alignItems: 'center'}}><div className="spinner"></div></div>;

  if (!state.activeShift) {
    return (
      <div className="pos" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        <div className="pos__open-modal" style={{ maxWidth: '400px' }}>
          <h2 style={{ textAlign: 'center', marginBottom: 'var(--space-4)' }}>فتح شيفت جديد</h2>
          <form onSubmit={handleOpenShift} className="form-grid">
            <div className="field">
              <label className="field__label">الكاشير (الدرج)</label>
              <select className="field-select__control" value={startShiftForm.registerId} onChange={e => setStartShiftForm({...startShiftForm, registerId: e.target.value})} required>
                <option value="">-- اختار الدرج --</option>
                {registers.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
            </div>
            <div className="field">
              <label className="field__label">العهدة الافتتاحية (Float)</label>
              <input type="number" step="0.01" min="0" required className="field__input field__wrapper" value={startShiftForm.openingFloat} onChange={e => setStartShiftForm({...startShiftForm, openingFloat: e.target.value})} />
            </div>
            <button type="submit" className="btn btn--primary btn--md" style={{ gridColumn: '1/-1' }}>ابدأ الشيفت</button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="pos">
      {/* LEFT — Tables */}
      <TableGrid
        tables={state.tables}
        orders={state.activeOrders}
        activeTable={state.activeTable}
        activeOrder={state.activeOrder}
        loading={state.isLoadingTables}
        onTableClick={handleTableClick}
        onTakeawayClick={(order) => dispatch({ type: 'SELECT_ORDER', payload: order })}
        onNewTakeawayClick={() => setOpenTakeawayModal(true)}
        onCloseShift={() => setShowCloseShift(true)}
      />

      {/* CENTER — Menu */}
      <MenuPanel
        categories={state.categories}
        products={state.products}
        selectedCategoryId={state.selectedCategoryId}
        loading={state.isLoadingMenu}
        onCategorySelect={handleCategorySelect}
        onProductClick={handleAddProduct}
      />

      {/* RIGHT — Order */}
      <OrderPanel
        table={state.activeTable}
        order={state.activeOrder}
        loading={state.isLoadingOrder}
        role={role}
        onSend={handleSend}
        onServe={handleServe}
        onCancelItem={handleCancelItem}
        onPayClick={() => setShowPayment(true)}
      />

      {/* Open order modal */}
      {openTableModal && state.activeTable && (
        <div className="pos__open-modal-overlay" onClick={() => setOpenTableModal(false)}>
          <div className="pos__open-modal" onClick={(e) => e.stopPropagation()}>
            <h3>فتح ترابيزة {state.activeTable.number}</h3>
            <div className="pos__open-actions" style={{marginTop: 'var(--space-4)'}}>
              <button className="btn btn--secondary btn--md" onClick={() => setOpenTableModal(false)}>إلغاء</button>
              <button className="btn btn--primary btn--md" onClick={handleOpenOrder}>فتح الأوردر</button>
            </div>
          </div>
        </div>
      )}

      {/* Open Takeaway Modal */}
      {openTakeawayModal && (
        <div className="pos__open-modal-overlay" onClick={() => setOpenTakeawayModal(false)}>
          <div className="pos__open-modal" onClick={(e) => e.stopPropagation()}>
            <h3 style={{ marginBottom: 'var(--space-4)', textAlign: 'center' }}>أوردر تيك أواي جديد</h3>
            <form onSubmit={handleOpenTakeawayOrder} className="form-grid">
              <div className="field" style={{ gridColumn: '1/-1' }}>
                <label className="field__label">اسم العميل (مطلوب)</label>
                <input
                  type="text"
                  required
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="field__input field__wrapper"
                  placeholder="مثال: أحمد"
                  autoFocus
                />
              </div>
              <div className="field" style={{ gridColumn: '1/-1' }}>
                <label className="field__label">رقم الموبايل (اختياري)</label>
                <input
                  type="text"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  className="field__input field__wrapper"
                  placeholder="مثال: 010..."
                />
              </div>
              <div className="pos__open-actions" style={{ gridColumn: '1/-1', marginTop: 'var(--space-2)' }}>
                <button type="button" className="btn btn--secondary btn--md" onClick={() => setOpenTakeawayModal(false)}>إلغاء</button>
                <button type="submit" className="btn btn--primary btn--md">فتح الأوردر</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Payment Modal */}
      {showPayment && state.activeOrder && (
        <PaymentModal
          order={state.activeOrder}
          onClose={() => setShowPayment(false)}
          onSuccess={handlePaymentSuccess}
        />
      )}

      {/* POS Option Selection Modal */}
      {showPosOptionsModal && posOptionsProduct && (
        <div className="pos__open-modal-overlay" onClick={() => { setShowPosOptionsModal(false); setPosOptionsProduct(null); }}>
          <div className="pos__open-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '450px' }}>
            <h3 style={{ textAlign: 'center', marginBottom: 'var(--space-3)' }}>إضافات وأحجام لـ {posOptionsProduct.name}</h3>
            
            <div className="pos-options-selection-list" style={{ display: 'flex', flexDirection: 'column', gap: '10px', margin: '16px 0', maxHeight: '300px', overflowY: 'auto' }}>
              {posOptionsList.map(option => {
                const isSelected = selectedOptionIds.includes(option.id);
                return (
                  <label 
                    key={option.id}
                    className="pos-option-item"
                    style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'space-between',
                      padding: '12px',
                      borderRadius: '8px',
                      background: 'var(--bg-surface-hover)',
                      border: isSelected ? '2px solid var(--primary)' : '1px solid var(--border-color)',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      userSelect: 'none'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <input 
                        type="checkbox"
                        checked={isSelected}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedOptionIds(prev => [...prev, option.id]);
                          } else {
                            setSelectedOptionIds(prev => prev.filter(id => id !== option.id));
                          }
                        }}
                        style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                      />
                      <span style={{ fontWeight: 500 }}>{option.nameAr}</span>
                    </div>
                    <span style={{ color: isSelected ? 'var(--primary)' : 'var(--text-muted)', fontWeight: 600 }}>
                      {option.priceDelta > 0 ? `+${option.priceDelta} ج.م` : option.priceDelta < 0 ? `-${Math.abs(option.priceDelta)} ج.م` : '0.00 ج.م'}
                    </span>
                  </label>
                );
              })}
            </div>

            <div className="pos__open-actions" style={{ marginTop: 'var(--space-2)' }}>
              <button 
                type="button" 
                className="btn btn--secondary btn--md" 
                onClick={() => { setShowPosOptionsModal(false); setPosOptionsProduct(null); }}
              >
                إلغاء
              </button>
              <button 
                type="button" 
                className="btn btn--primary btn--md" 
                onClick={handleAddProductWithOptions}
              >
                إضافة للأوردر
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Close Shift Modal */}
      {showCloseShift && state.activeShift && (
        <div className="pos__open-modal-overlay" onClick={() => setShowCloseShift(false)}>
          <div className="pos__open-modal" onClick={(e) => e.stopPropagation()}>
            <h3 style={{ textAlign: 'center', marginBottom: 'var(--space-4)' }}>قفل الشيفت</h3>
            <form onSubmit={handleCloseShift} className="form-grid">
              <div className="field" style={{ gridColumn: '1/-1' }}>
                <label className="field__label">الكاش الفعلي في الدرج</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  required
                  className="field__input field__wrapper"
                  value={closeShiftForm.countedCash}
                  onChange={e => setCloseShiftForm({ countedCash: e.target.value })}
                  autoFocus
                />
              </div>
              <div className="pos__open-actions" style={{ gridColumn: '1/-1' }}>
                <button type="button" className="btn btn--secondary btn--md" onClick={() => setShowCloseShift(false)}>إلغاء</button>
                <button type="submit" className="btn btn--primary btn--md" style={{ background: 'var(--danger)' }}>تأكيد القفل</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Kitchen Ticket (Hidden normally, visible ONLY in print when kitchenTicket exists) */}
      {kitchenTicket && (
        <div className="kitchen-ticket-print-only" dir="rtl">
          <h2 style={{ textAlign: 'center', marginBottom: '10px' }}>بون مطبخ</h2>
          <p><strong>رقم الأوردر:</strong> #{kitchenTicket.orderNumber}</p>
          <p><strong>النوع:</strong> {kitchenTicket.type === 'TAKEAWAY' ? 'تيك أواي' : `ترابيزة ${kitchenTicket.tableNumber}`}</p>
          <p><strong>الوقت:</strong> {kitchenTicket.time.toLocaleTimeString('ar-EG')}</p>
          <hr style={{ margin: '10px 0', border: '1px dashed black' }} />
          <table style={{ width: '100%', textAlign: 'right', fontSize: '14px', fontWeight: 'bold' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid black' }}>
                <th style={{ padding: '4px 0' }}>الصنف</th>
                <th style={{ padding: '4px 0', textAlign: 'center' }}>الكمية</th>
              </tr>
            </thead>
            <tbody>
              {kitchenTicket.items.map(item => (
                <tr key={item.id} style={{ borderBottom: '1px dashed #ccc' }}>
                  <td style={{ padding: '8px 0' }}>
                    {item.productNameSnapshot}
                    {item.note && <div style={{ fontSize: '12px', fontWeight: 'normal' }}>ملاحظة: {item.note}</div>}
                  </td>
                  <td style={{ padding: '8px 0', textAlign: 'center', fontSize: '18px' }}>{item.quantity}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <hr style={{ margin: '10px 0', border: '1px dashed black' }} />
        </div>
      )}

      {/* Client Receipt (Visible ONLY in print when clientReceipt exists) */}
      {clientReceipt && (
        <div className="client-receipt-print-only" dir="rtl">
          <div style={{ textAlign: 'center', marginBottom: '10px' }}>
            <h2 style={{ margin: 0 }}>كافيه وناس</h2>
            <p style={{ margin: 0, fontSize: '12px' }}>فاتورة ضريبية</p>
          </div>
          
          <p><strong>رقم الأوردر:</strong> #{clientReceipt.orderNumber}</p>
          <p><strong>النوع:</strong> {clientReceipt.type === 'TAKEAWAY' ? 'تيك أواي' : `ترابيزة ${clientReceipt.tableId}`}</p>
          {clientReceipt.customerName && <p><strong>العميل:</strong> {clientReceipt.customerName}</p>}
          <p><strong>الوقت:</strong> {clientReceipt.time.toLocaleTimeString('ar-EG')}</p>
          <hr style={{ margin: '10px 0', border: '1px dashed black' }} />
          
          <table style={{ width: '100%', textAlign: 'right', fontSize: '12px' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid black' }}>
                <th style={{ padding: '4px 0' }}>الصنف</th>
                <th style={{ padding: '4px 0', textAlign: 'center' }}>الكمية</th>
                <th style={{ padding: '4px 0', textAlign: 'left' }}>الإجمالي</th>
              </tr>
            </thead>
            <tbody>
              {clientReceipt.items?.filter(i => i.status !== 'CANCELLED').map(item => (
                <tr key={item.id}>
                  <td style={{ padding: '4px 0' }}>{item.productNameSnapshot}</td>
                  <td style={{ padding: '4px 0', textAlign: 'center' }}>{item.quantity}</td>
                  <td style={{ padding: '4px 0', textAlign: 'left' }}>{(item.lineTotal).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          
          <hr style={{ margin: '10px 0', border: '1px dashed black' }} />
          
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', fontWeight: 'bold' }}>
            <span>الإجمالي:</span>
            <span>{parseFloat(clientReceipt.total).toFixed(2)} ج.م</span>
          </div>
          
          <div style={{ textAlign: 'center', marginTop: '20px', fontSize: '12px' }}>
            <p>شكراً لزيارتكم!</p>
          </div>
        </div>
      )}
    </div>
  );
}
