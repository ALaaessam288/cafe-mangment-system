import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { ShoppingBag, Bike, Search, UserCheck, MapPin, Phone, Sparkles, UserPlus } from 'lucide-react';
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
import ModifierDialog from './ModifierDialog';
import ShiftStrip    from './ShiftStrip';
import ShiftAuditModal from '../../components/ShiftAuditModal/ShiftAuditModal';
import { fallbackTopSellers } from './menuGroups';
import { getQuickAccessProducts, recordProductUse } from './recentProducts';
import './POSPage.css';
import { printReceipt, buildReceiptHtml, buildKitchenTicketHtml } from '../../utils/printUtils';
import { formatCurrency, formatDateTime } from '../../utils/formatters';
import { printOptionsFor } from '../../utils/printerSettings';
import { ROLES } from '../../utils/constants';
import { DONE, serveDone } from '../../utils/labels';
import { sounds } from '../../utils/soundEffects';

/* ── Reducer ── */
const initialState = {
  tables:        [],
  activeOrders:  [],
  customers:     [],   // takeaway customers seen before, for recall on a new order
  categories:    [],
  products:      [],   // whole menu, loaded once - powers instant search + category filtering
  topProducts:   [],   // pre-filtered subset shown on the Top tab
  activeTable:   null, // selected table (null when in takeaway mode)
  activeOrder:   null, // loaded order for activeTable or active takeaway
  activeShift:   null, // current open shift for this user, or null if register closed
  isLoadingTables: false,
  isLoadingOrders: false,
  isLoadingMenu:   false,
  isLoadingOrder:  false,
};

function num(v) {
  const n = parseFloat(v);
  return isNaN(n) ? 0 : n;
}

/* Optimistic lines carry a string id (`tmp-…`) so they're easy to tell apart
   from real server rows, which always have numeric ids. */
export const isTempItem = (item) => typeof item?.id === 'string';

function applyTempDelta(order, delta) {
  return {
    ...order,
    subtotal:   num(order.subtotal) + delta,
    total:      num(order.total) + delta,
    balanceDue: num(order.balanceDue) + delta,
  };
}

function reducer(state, action) {
  switch (action.type) {
    /* ── Optimistic add: the line shows up the instant the cashier taps,
          then gets replaced by the authoritative server order. ── */
    case 'ADD_TEMP_ITEM': {
      const item = action.payload.item || action.payload;
      const baseOrder = action.payload.baseOrder || state.activeOrder;
      if (!baseOrder) return state;
      const order = applyTempDelta(baseOrder, num(item.lineTotal));
      return { ...state, activeOrder: { ...order, items: [...(baseOrder.items ?? []), item] } };
    }
    case 'REMOVE_TEMP_ITEM': {
      if (!state.activeOrder) return state;
      const item = (state.activeOrder.items ?? []).find((i) => i.id === action.payload);
      if (!item) return state;
      const order = applyTempDelta(state.activeOrder, -num(item.lineTotal));
      return {
        ...state,
        activeOrder: { ...order, items: state.activeOrder.items.filter((i) => i.id !== action.payload) },
      };
    }
    case 'SET_TABLES':   return { ...state, tables: action.payload };
    case 'SET_ORDERS':   return { ...state, activeOrders: action.payload };
    case 'SET_CUSTOMERS': return { ...state, customers: action.payload };
    case 'SET_CATS':     return { ...state, categories: action.payload };
    case 'SET_PRODUCTS': return { ...state, products: action.payload };
    case 'SET_TOP':      return { ...state, topProducts: action.payload };
    case 'DEDUCT_PRODUCT_STOCK': {
      const { productId, quantity } = action.payload;
      const updateList = (list) => (list ?? []).map((p) =>
        p.id === productId
          ? {
              ...p,
              stockQuantity: Math.max(0, (p.stockQuantity ?? p.availableQuantity ?? 0) - quantity),
              availableQuantity: Math.max(0, (p.availableQuantity ?? p.stockQuantity ?? 0) - quantity),
            }
          : p
      );
      return {
        ...state,
        products: updateList(state.products),
        topProducts: updateList(state.topProducts),
      };
    }
    case 'RESTORE_PRODUCT_STOCK': {
      const { productId, quantity } = action.payload;
      const updateList = (list) => (list ?? []).map((p) =>
        p.id === productId
          ? {
              ...p,
              stockQuantity: (p.stockQuantity ?? p.availableQuantity ?? 0) + quantity,
              availableQuantity: (p.availableQuantity ?? p.stockQuantity ?? 0) + quantity,
            }
          : p
      );
      return {
        ...state,
        products: updateList(state.products),
        topProducts: updateList(state.topProducts),
      };
    }
    case 'REFILL_PRODUCT_STOCK': {
      const { productId, quantity } = action.payload;
      const updateList = (list) => (list ?? []).map((p) =>
        p.id === productId
          ? {
              ...p,
              stockQuantity: (p.stockQuantity ?? 0) + quantity,
              availableQuantity: (p.availableQuantity ?? 0) + quantity,
              available: true,
              active: true,
            }
          : p
      );
      return {
        ...state,
        products: updateList(state.products),
        topProducts: updateList(state.topProducts),
      };
    }
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
  const [takeawayMode, setTakeawayMode] = useState('DIRECT'); // 'DIRECT' | 'DELIVERY'
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [deliveryFee, setDeliveryFee] = useState('');
  const [matchedCustomer, setMatchedCustomer] = useState(null);

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
  const [showMoveModal, setShowMoveModal] = useState(false);
  const [targetTableId, setTargetTableId] = useState('');
  const [showOpeningAudit, setShowOpeningAudit] = useState(false);
  const [showClosingAudit, setShowClosingAudit] = useState(false);

  // Quick Refill Modal states inside POS
  const [refillProduct, setRefillProduct] = useState(null);
  const [refillMode, setRefillMode] = useState('GRAMS'); // 'GRAMS' or 'PIECES'
  const [refillQty, setRefillQty] = useState('');
  const [refillGrams, setRefillGrams] = useState('');
  const [isSavingRefill, setIsSavingRefill] = useState(false);

  // Collapsible table panel - ~40 tables shouldn't own the screen once the
  // cashier has picked one.
  const [tablesCollapsed, setTablesCollapsed] = useState(false);

  // productId -> ProductOptionResponse[] (avoids re-fetching modifiers)
  const optionsCache = useRef(new Map());

  // Quantity multiplier: type a digit, then tap a product to add that many.
  const [multiplier, setMultiplier] = useState(1);

  // Quantity / note captured in the add dialog
  const [addQuantity, setAddQuantity] = useState(1);
  const [addNote, setAddNote] = useState('');

  // Last line this cashier added, so it can be undone in one action
  const [lastAddedItemId, setLastAddedItemId] = useState(null);

  // Bumped whenever the local "quick access" history changes
  const [quickVersion, setQuickVersion] = useState(0);

  // Bumped after every payment so the shift strip re-reads the report
  const [shiftRefreshKey, setShiftRefreshKey] = useState(0);

  const quickAccessProducts = useMemo(
    () => getQuickAccessProducts(user?.id, state.products),
    // quickVersion is the invalidation signal for the localStorage-backed list
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [user?.id, state.products, quickVersion]
  );

  const isSyncing = (state.activeOrder?.items ?? []).some(isTempItem);

  // Undo is available to whoever is running the till, cashiers included.
  //
  // This used to be gated on ADMIN/SUPERVISOR with a comment claiming the backend required it.
  // It does not - OrderController.cancelItem is @PreAuthorize("hasAnyRole('ADMIN','SUPERVISOR',
  // 'CASHIER')") and always has been. The effect was that the one person who actually mistypes an
  // order was the only one who could not take it back, so every slip meant fetching a supervisor.
  const canUndo =
    !!lastAddedItemId &&
    !!state.activeOrder &&
    !['CLOSED', 'VOIDED'].includes(state.activeOrder.status) &&
    (state.activeOrder.items ?? []).some((i) => i.id === lastAddedItemId && i.status !== 'CANCELLED');

  const anyModalOpen =
    showPayment || openTableModal || openTakeawayModal || showMoveModal ||
    showPosOptionsModal || showCloseShift;

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

      // Build a comprehensive recall list of takeaway & delivery customers from order history and localStorage
      const seen = new Map();
      let storedList = [];
      try {
        const raw = localStorage.getItem('wanas_customers_book');
        if (raw) storedList = JSON.parse(raw);
      } catch (e) {
        console.error(e);
      }
      storedList.forEach((c) => {
        if (c.phone) seen.set(c.phone.trim(), c);
        if (c.name && !seen.has(c.name.trim())) seen.set(c.name.trim(), c);
      });

      [...data]
        .sort((a, b) => new Date(b.openedAt ?? 0) - new Date(a.openedAt ?? 0))
        .forEach((o) => {
          const phone = (o.customerPhone ?? '').trim();
          const name = (o.customerName ?? '').trim();
          const address = (o.customerAddress ?? '').trim();
          if (phone) {
            const prev = seen.get(phone) || {};
            seen.set(phone, {
              phone,
              name: name || prev.name || '',
              address: address || prev.address || '',
              deliveryFee: o.deliveryFee || prev.deliveryFee || 0,
              lastOrderAt: o.openedAt || prev.lastOrderAt,
            });
          } else if (name && !seen.has(name)) {
            seen.set(name, { name, phone: '', address: '', lastOrderAt: o.openedAt });
          }
        });
      dispatch({ type: 'SET_CUSTOMERS', payload: [...seen.values()].slice(0, 500) });
    } catch (err) {
      toast.error(err.message, 'فشل في تحميل الأوردرات');
    } finally {
      dispatch({ type: 'LOADING_ORDERS', payload: false });
    }
  }, [toast]);

  // Customer storage in localStorage
  function getStoredCustomers() {
    try {
      const raw = localStorage.getItem('wanas_customers_book');
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  function saveCustomerToBook(customer) {
    if (!customer?.phone && !customer?.name) return;
    try {
      const list = getStoredCustomers();
      const cleanPhone = (customer.phone || '').trim();
      const cleanName = (customer.name || '').trim();
      const existingIdx = list.findIndex(c => (cleanPhone && c.phone === cleanPhone) || (cleanName && c.name === cleanName));
      const updated = {
        name: cleanName,
        phone: cleanPhone,
        address: (customer.address || '').trim(),
        deliveryFee: customer.deliveryFee || 0,
        lastOrderAt: new Date().toISOString()
      };
      if (existingIdx >= 0) {
        list[existingIdx] = { ...list[existingIdx], ...updated };
      } else {
        list.unshift(updated);
      }
      localStorage.setItem('wanas_customers_book', JSON.stringify(list.slice(0, 500)));
    } catch (err) {
      console.error('Failed to save customer to book', err);
    }
  }

  function handlePhoneChange(val) {
    setCustomerPhone(val);
    const clean = val.trim();
    if (clean.length >= 4) {
      const stored = getStoredCustomers();
      const fromState = state.customers || [];
      const match = stored.find(c => c.phone && (c.phone === clean || c.phone.endsWith(clean) || clean.endsWith(c.phone)))
        || fromState.find(c => c.phone && (c.phone === clean || c.phone.endsWith(clean) || clean.endsWith(c.phone)));
      if (match) {
        setMatchedCustomer(match);
        if (match.name) setCustomerName(match.name);
        if (match.address) setCustomerAddress(match.address);
        if (match.deliveryFee && !deliveryFee) setDeliveryFee(String(match.deliveryFee));
        return;
      }
    }
    setMatchedCustomer(null);
  }

  /* ── Load menu ──
     The whole menu is fetched once instead of one request per category tab.
     Switching a category or typing in search is then pure client-side
     filtering, which is what makes the cashier flow feel instant. */
  const loadMenu = useCallback(async (categories) => {
    dispatch({ type: 'LOADING_MENU', payload: true });
    try {
      const [all, top] = await Promise.all([
        menuApi.getProducts(),
        menuApi.getTopSellers().catch(() => []),
      ]);

      const sellable = all.filter((p) => p.active && p.available);
      dispatch({ type: 'SET_PRODUCTS', payload: sellable });

      const sellableIds = new Set(sellable.map((p) => p.id));
      const topSellable = top.filter((p) => sellableIds.has(p.id));
      dispatch({
        type: 'SET_TOP',
        // No sales history yet (fresh install): fall back to a spread of the
        // real menu rather than an empty screen. Never hardcoded names.
        payload: topSellable.length > 0 ? topSellable : fallbackTopSellers(sellable, categories),
      });
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

          let activeReg = (reg || []).filter(r => r.active !== false);
          if (activeReg.length === 0 && (reg || []).length > 0) activeReg = reg;
          setRegisters(activeReg);
          if (activeReg.length > 0) {
            setStartShiftForm(prev => ({ ...prev, registerId: String(activeReg[0].id) }));
          }
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
        await loadMenu(active);
      } catch (err) {
        toast.error(err.message, 'فشل في تحميل الأقسام');
      }
    }
    boot();
  }, [loadTables, loadOrders, loadMenu, toast]);

  useEffect(() => {
    const handleReload = async () => {
      try {
        const cats = await menuApi.getCategories();
        const active = cats.filter((c) => c.active);
        dispatch({ type: 'SET_CATS', payload: active });
        await loadMenu(active);
      } catch (e) {
        console.error('Failed to reload menu', e);
      }
    };
    window.addEventListener('reload-pos-menu', handleReload);
    return () => window.removeEventListener('reload-pos-menu', handleReload);
  }, [loadMenu]);

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
      setShowOpeningAudit(true);
    } catch (err) {
      toast.error(err.message, 'فشل في فتح الشيفت');
    }
  }

  /* ── Close Shift ── */
  async function handleCloseShift(e) {
    e.preventDefault();
    if (closeShiftForm.countedCash === '' || closeShiftForm.countedCash === undefined || isNaN(parseFloat(closeShiftForm.countedCash))) {
      toast.warning('يرجى إدخال مبلغ الكاش الفعلي الموجود في الدرج بدقة');
      return;
    }
    const counted = parseFloat(closeShiftForm.countedCash);
    if (counted < 0) {
      toast.warning('لا يمكن إدخال مبلغ كاش سالب في الدرج');
      return;
    }

    // Check for open active orders on tables or takeaway
    const activeUnsettledOrders = (state.activeOrders || []).filter(
      o => o.status === 'OPEN' || o.status === 'SENT' || o.status === 'SERVED' || o.status === 'READY_FOR_PICKUP'
    );
    if (activeUnsettledOrders.length > 0) {
      toast.error(
        `لا يمكن إغلاق الشيفت: يوجد ${activeUnsettledOrders.length} طلب مفتوح أو غير مدفوع على الطاولات/التيك أواي. يرجى محاسبة الطلبات أو إلغاؤها أولاً قبل القفل.`,
        'طلبات معلقة'
      );
      return;
    }

    try {
      let closedShiftId = state.activeShift?.id;
      if (!closedShiftId) {
        const openShifts = await shiftsApi.findAll(true).catch(() => []);
        if (openShifts.length > 0) {
          closedShiftId = openShifts[0].id;
        }
      }
      if (!closedShiftId) {
        toast.warning('لا يوجد شيفت مفتوح لقفله');
        return;
      }
      await shiftsApi.close(closedShiftId, {
        countedCash: counted,
        snacksNet: closeShiftForm.snacksNet ? (parseFloat(closeShiftForm.snacksNet) || 0) : 0
      });
      toast.success('تم قفل الشيفت بنجاح! جاري عرض تقرير جرد الهدر...');
      setShowCloseShift(false);
      setCloseShiftForm({ countedCash: '', snacksNet: '' });
      dispatch({ type: 'SET_SHIFT', payload: null });
      setShowClosingAudit(true);
      // Reset active orders/tables
      dispatch({ type: 'CLEAR_TABLE' });
    } catch (err) {
      toast.error(err.message, 'فشل في قفل الشيفت');
    }
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

  /* ── Open Takeaway or Delivery order ── */
  async function handleOpenTakeawayOrder(e) {
    if (e) e.preventDefault();
    if (!state.activeShift) {
      toast.error('لا يوجد شيفت مفتوح حالياً للكاشير');
      return;
    }
    dispatch({ type: 'LOADING_ORDER', payload: true });
    try {
      const isDirect = takeawayMode === 'DIRECT';
      let effName = customerName.trim();
      if (!effName) {
        effName = isDirect ? 'تيك أواي' : (customerPhone.trim() ? `دليفري (${customerPhone.trim()})` : 'دليفري');
      }
      const effPhone = customerPhone.trim() || undefined;
      const effAddress = !isDirect ? (customerAddress.trim() || undefined) : undefined;
      const effDeliveryFee = !isDirect ? (parseFloat(deliveryFee) || 0) : undefined;

      // Save customer to local directory book if phone is provided
      if (effPhone && !isDirect) {
        saveCustomerToBook({
          name: effName,
          phone: effPhone,
          address: effAddress,
          deliveryFee: effDeliveryFee
        });
      }

      const order = await ordersApi.open({
        type:         'TAKEAWAY',
        customerName: effName,
        customerPhone: effPhone,
        customerAddress: effAddress,
        deliveryFee:  effDeliveryFee,
        shiftId:      state.activeShift.id,
        userId:       user.id
      });

      dispatch({ type: 'SELECT_ORDER', payload: order });
      setOpenTakeawayModal(false);
      setCustomerName('');
      setCustomerPhone('');
      setCustomerAddress('');
      setDeliveryFee('');
      setMatchedCustomer(null);
      toast.success(isDirect ? 'تم فتح أوردر تيك أواي!' : 'تم فتح أوردر دليفري بنجاح!');
      await loadOrders();
    } catch (err) {
      toast.error(err.message, 'فشل في فتح الأوردر');
    } finally {
      dispatch({ type: 'LOADING_ORDER', payload: false });
    }
  }

  /* ── Add item ── */
  /* Makes sure there's an order to add to, opening one for the selected table
     if needed. Returns the order, or null when the cashier still has to pick
     a table. */
  async function ensureOrder() {
    if (state.activeOrder) return state.activeOrder;
    if (!state.activeTable) {
      toast.warning('لازم تختار ترابيزة أو تفتح أوردر تيك أواي الأول.');
      return null;
    }
    dispatch({ type: 'LOADING_ORDER', payload: true });
    try {
      const newOrder = await ordersApi.open({
        tableId: state.activeTable.id,
        type:    'DINE_IN',
        shiftId: state.activeShift ? state.activeShift.id : undefined,
        userId:  user?.id,
      });
      dispatch({ type: 'SET_ORDER', payload: newOrder });
      toast.success(`اتفتح أوردر لترابيزة ${state.activeTable.number}`);
      // Not awaited: the cashier shouldn't wait on a table/order refresh.
      loadTables();
      loadOrders();
      return newOrder;
    } catch (err) {
      toast.error(err.message, 'فشل في فتح الأوردر تلقائياً');
      return null;
    } finally {
      dispatch({ type: 'LOADING_ORDER', payload: false });
    }
  }

  /* The single write path for adding a line. Draws the line optimistically so
     the bill updates on tap, then reconciles with the server response - which
     remains the only source of truth for prices and totals. */
  async function addToOrder(order, product, { quantity = 1, note = '', optionIds = [], options = [] } = {}) {
    if (['CLOSED', 'VOIDED'].includes(order.status)) {
      toast.warning('الأوردر ده مقفول أصلاً.');
      return;
    }
    sounds.playAddItem();

    const optionDelta = options
      .filter((o) => optionIds.includes(o.id))
      .reduce((sum, o) => sum + (parseFloat(o.priceDelta ?? 0) || 0), 0);
    const unitPrice = (parseFloat(product.price ?? 0) || 0) + optionDelta;

    const tempId = `tmp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    dispatch({
      type: 'ADD_TEMP_ITEM',
      payload: {
        item: {
          id: tempId,
          productId: product.id,
          productNameSnapshot: product.name,
          categoryNameSnapshot: product.categoryNameAr,
          unitPriceSnapshot: unitPrice,
          stationSnapshot: product.stationCode,
          revenueLineSnapshot: product.revenueLine,
          quantity,
          status: 'PENDING',
          note: note || null,
          cancelReason: null,
          discountAmount: 0,
          lineTotal: unitPrice * quantity,
        },
        baseOrder: order,
      },
    });

    // Deduct stock and progress bar INSTANTLY on click
    dispatch({
      type: 'DEDUCT_PRODUCT_STOCK',
      payload: { productId: product.id, quantity },
    });

    try {
      const updated = await ordersApi.addItem(order.id, {
        productId: product.id,
        quantity,
        note: note?.trim() ? note.trim() : undefined,
        optionIds: optionIds.length > 0 ? optionIds : undefined,
      });
      dispatch({ type: 'SET_ORDER', payload: updated });

      // Newest server row = the one to undo, and one more tally for this
      // cashier's quick-access strip.
      const newest = (updated.items ?? []).reduce((max, i) => (i.id > max ? i.id : max), 0);
      setLastAddedItemId(newest || null);
      recordProductUse(user?.id, product.id, quantity);
      setQuickVersion((v) => v + 1);
    } catch (err) {
      dispatch({ type: 'REMOVE_TEMP_ITEM', payload: tempId });
      // Rollback stock on error
      dispatch({
        type: 'RESTORE_PRODUCT_STOCK',
        payload: { productId: product.id, quantity },
      });
      toast.error(err.message, 'فشل في إضافة الصنف');
    }
  }

  /* Reads a product's options, cached - the second tap on the same drink
     costs no round-trip at all. */
  async function getOptionsFor(productId) {
    let options = optionsCache.current.get(productId);
    if (!options) {
      options = (await menuApi.getOptions(productId)) ?? [];
      optionsCache.current.set(productId, options);
    }
    return options;
  }

  /* One tap on a product card. */
  async function handleAddProduct(product) {
    const quantity = multiplier;
    setMultiplier(1);

    const currentStock = product.availableQuantity !== undefined ? product.availableQuantity : (product.stockQuantity ?? 0);
    const isTracked = product.trackInventory || product.availableQuantity !== undefined || (product.stockQuantity !== undefined && product.stockQuantity !== null);

    // If stock is 0 or depleted, show popup to refill
    if (isTracked && currentStock <= 0) {
      setRefillProduct(product);
      const isRecipe = Boolean(product.primaryIngredientName || product.recipeInventory);
      if (isRecipe) {
        setRefillMode('GRAMS');
        setRefillGrams('250');
        const perCup = product.deductionQuantity || 10;
        setRefillQty(String(Math.floor(250 / perCup)));
      } else {
        setRefillMode('PIECES');
        setRefillQty('10');
        setRefillGrams('');
      }
      return;
    }

    const order = await ensureOrder();
    if (!order) return;

    try {
      const options = await getOptionsFor(product.id);
      if (options.length > 0) {
        // Has real modifiers - ask, don't guess.
        setPosOptionsProduct(product);
        setPosOptionsList(options);
        setSelectedOptionIds(options.filter((o) => o.isDefault).map((o) => o.id));
        setAddQuantity(quantity);
        setAddNote('');
        setShowPosOptionsModal(true);
      } else {
        await addToOrder(order, product, { quantity });
      }
    } catch (err) {
      toast.error(err.message, 'فشل في إضافة الصنف');
    }
  }

  /* Quick refill stock for an out-of-stock product, then auto-add it to the order. */
  async function handleRefillAndAdd() {
    if (!refillProduct) return;
    const isRecipe = Boolean(refillProduct.primaryIngredientName || refillProduct.recipeInventory);
    const perCup = refillProduct.deductionQuantity || 10;

    let rawQty = null;
    let pieceQty = null;

    if (isRecipe) {
      if (refillMode === 'GRAMS') {
        const g = parseFloat(refillGrams);
        if (isNaN(g) || g <= 0) {
          toast.warning('الرجاء إدخال كمية صحيحة بالجرام أكبر من الصفر');
          return;
        }
        rawQty = g;
        pieceQty = Math.max(1, Math.floor(g / perCup));
      } else {
        const q = parseInt(refillQty);
        if (isNaN(q) || q <= 0) {
          toast.warning('الرجاء إدخال عدد قطع أو فناجين صحيح أكبر من الصفر');
          return;
        }
        pieceQty = q;
        rawQty = q * perCup;
      }
    } else {
      const q = parseInt(refillQty);
      if (isNaN(q) || q <= 0) {
        toast.warning('الرجاء إدخال كمية صحيحة أكبر من الصفر');
        return;
      }
      pieceQty = q;
    }

    setIsSavingRefill(true);
    try {
      const updatedProduct = await menuApi.addStock(refillProduct.id, {
        quantity: pieceQty,
        rawQuantity: rawQty
      });

      const successMsg = isRecipe
        ? `تم تغذية مخزون «${refillProduct.primaryIngredientName || 'المادة الخام'}» بـ ${rawQty} ${refillProduct.primaryIngredientUnit || 'جرام'} (تكفي لعمل ${pieceQty} فنجان) بنجاح 🎉`
        : `تم تغذية مخزون «${refillProduct.name}» بـ ${pieceQty} قطعة بنجاح 🎉`;
      toast.success(successMsg);

      // Refresh menu products
      await loadMenu(state.categories);

      // Auto-add the product to the current order
      const order = await ensureOrder();
      if (order) {
        await addToOrder(order, updatedProduct || refillProduct, { quantity: 1 });
      }

      setRefillProduct(null);
      setRefillQty('');
      setRefillGrams('');
    } catch (err) {
      toast.error(err.message, 'فشل في تغذية المخزون');
    } finally {
      setIsSavingRefill(false);
    }
  }

  /* Right-click a product: set an explicit quantity and/or a kitchen note,
     even for products that have no options. */
  async function handleProductDetails(product) {
    const order = await ensureOrder();
    if (!order) return;
    try {
      const options = await getOptionsFor(product.id);
      setPosOptionsProduct(product);
      setPosOptionsList(options);
      setSelectedOptionIds(options.filter((o) => o.isDefault).map((o) => o.id));
      setAddQuantity(multiplier);
      setAddNote('');
      setMultiplier(1);
      setShowPosOptionsModal(true);
    } catch (err) {
      toast.error(err.message, 'فشل في تحميل اختيارات الصنف');
    }
  }

  async function handleAddProductWithOptions() {
    if (!state.activeOrder || !posOptionsProduct) return;
    const product = posOptionsProduct;
    const payload = {
      quantity: addQuantity,
      note: addNote,
      optionIds: selectedOptionIds,
      options: posOptionsList,
    };

    setShowPosOptionsModal(false);
    setPosOptionsProduct(null);
    setPosOptionsList([]);
    setSelectedOptionIds([]);
    setAddQuantity(1);
    setAddNote('');

    await addToOrder(state.activeOrder, product, payload);
  }

  /* ── 86 an item straight from the till ──
     Uses the existing availability endpoint, which the backend limits to
     admins/supervisors - so the button only shows for them. The item stays in
     the database and can be switched back on from Products. */
  async function handleMarkUnavailable(product) {
    try {
      await menuApi.setAvailability(product.id, false);
      dispatch({
        type: 'SET_PRODUCTS',
        payload: state.products.filter((p) => p.id !== product.id),
      });
      dispatch({
        type: 'SET_TOP',
        payload: state.topProducts.filter((p) => p.id !== product.id),
      });
      setShowPosOptionsModal(false);
      setPosOptionsProduct(null);
      toast.success(`«${product.name}» اتشال من شاشة الكاشير.`);
    } catch (err) {
      toast.error(err.message, 'فشل في إخفاء الصنف');
    }
  }

  /* ── Undo the last line this cashier added ──
     Almost always still NEW (it was added seconds ago), so this deletes it outright rather than
     recording a cancellation. Falls back to the audited cancel path only if the order was sent to
     the kitchen in between. */
  async function handleUndoLastItem() {
    if (!state.activeOrder || !lastAddedItemId) return;

    const item = (state.activeOrder.items ?? []).find((i) => i.id === lastAddedItemId);
    const alreadySent = item?.status === 'SENT';

    try {
      const updated = alreadySent
        ? await ordersApi.cancelItem(state.activeOrder.id, lastAddedItemId, {
            reason: 'تراجع عن آخر إضافة',
          })
        : await ordersApi.removeItem(state.activeOrder.id, lastAddedItemId);

      dispatch({ type: 'SET_ORDER', payload: updated });
      if (item?.productId) {
        const qty = item.quantity || 1;
        dispatch({
          type: 'RESTORE_PRODUCT_STOCK',
          payload: { productId: item.productId, quantity: qty },
        });
      }
      setLastAddedItemId(null);
      toast.success('تم التراجع عن آخر صنف.');
      loadOrders();
    } catch (err) {
      toast.error(err.message, 'فشل في التراجع');
    }
  }

  /* ── Increase quantity of a line already on the bill ──
     Reuses the existing addItem endpoint (same as tapping the product again),
     so pricing/options/order logic stays exactly as the backend defines it. */
  async function handleIncreaseItem(group) {
    if (!state.activeOrder || !group) return;
    const prodId = group.productId || (state.products.find((p) => p.name === group.productNameSnapshot)?.id);
    const product = (prodId ? state.products.find((p) => p.id === prodId) : null) ?? {
      id: prodId,
      name: group.productNameSnapshot,
      price: group.unitPriceSnapshot,
      stationCode: group.stationSnapshot,
      revenueLine: group.revenueLineSnapshot,
    };
    if (!product.id) {
      toast.error('لم يتم التعرف على الصنف');
      return;
    }
    await addToOrder(state.activeOrder, product, { quantity: 1, note: group.note ?? '' });
  }

  /* ── Move/Merge Table ── */
  async function handleMoveTable(e) {
    e.preventDefault();
    if (!state.activeOrder || !targetTableId) return;
    
    const targetTable = state.tables.find(t => t.id === parseInt(targetTableId));
    if (!targetTable) return;
    
    const isTargetOccupied = state.activeOrders.some(
      o => o.tableId === targetTable.id && (o.status === 'OPEN' || o.status === 'SENT' || o.status === 'SERVED')
    );
    
    if (isTargetOccupied) {
      if (!window.confirm(`الطاولة ${targetTable.number} مشغولة حالياً، هل متأكد من دمج هذا الأوردر مع أوردر الطاولة ${targetTable.number}؟ (سيتم نقل كل الأصناف للطاولة الهدف)`)) {
        return;
      }
    }
    
    try {
      await ordersApi.transferTable(state.activeOrder.id, {
        tableId: targetTable.id,
        merge: isTargetOccupied
      });
      toast.success(isTargetOccupied ? 'تم دمج الأوردر بنجاح!' : 'تم نقل الأوردر بنجاح!');
      setShowMoveModal(false);
      setTargetTableId('');
      dispatch({ type: 'CLEAR_TABLE' });
      await loadTables();
      await loadOrders();
    } catch (err) {
      toast.error(err.message, 'فشل في عملية النقل/الدمج');
    }
  }

  /* ── Station tickets ───────────────────────────────────────────────
     One ticket per station, always. The item's own stationSnapshot (assigned
     server-side per product) decides who prepares it - never a guess from the
     category or revenue line. So an order containing both أكل and بوفيه
     produces TWO separate slips: one for the kitchen/restaurant and one for
     the bar/buffet, each routed to that station's own printer when the
     terminal has been configured in Settings.

     Printed through the Electron IPC path with an explicit 80mm page: the
     browser's window.print() ignores CSS @page sizing and falls back to the OS
     default page (A4), which is what used to crop tickets. */
  async function printStationTickets(items, ticketType) {
    // Merge identical lines so the cook reads "3 لاتيه", not three slips of one.
    function groupItems(list) {
      const grouped = [];
      list.forEach((item) => {
        const existing = grouped.find(
          (g) =>
            g.productNameSnapshot === item.productNameSnapshot &&
            g.categoryNameSnapshot === item.categoryNameSnapshot &&
            g.note === item.note
        );
        if (existing) existing.quantity += item.quantity;
        else grouped.push({ ...item });
      });
      return grouped;
    }

    // Group by station, preserving the order stations were first seen in.
    const byStation = new Map();
    items.forEach((item) => {
      const prod = state.products.find((p) => p.id === item.productId);
      const rawStation = item.stationSnapshot || prod?.stationCode;
      const rawRev = item.revenueLineSnapshot || prod?.revenueLine;
      const station = (rawStation === 'BAR' || rawRev === 'BUFFET') ? 'BAR' : 'KITCHEN';
      if (!byStation.has(station)) byStation.set(station, []);
      byStation.get(station).push(item);
    });

    const LABELS = {
      KITCHEN: 'المطبخ  /  المطعم',
      BAR:     'البار  /  البوفيه',
    };

    const time = new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

    for (const [station, stationItems] of byStation) {
      const html = buildKitchenTicketHtml({
        orderNumber: state.activeOrder.orderNumber,
        tableNumber: state.activeTable?.number,
        type: state.activeOrder.type,
        guestCount: state.activeOrder.guestCount,
        items: groupItems(stationItems),
        // ASCII digits - thermal heads have no glyphs for Arabic-Indic numerals
        // and drop the whole run, which printed the time as blank.
        time,
        waiterName: user?.fullName,
        ticketType,
        label: LABELS[station],
      });
      // Each station's slip goes to that station's printer. Jobs are queued
      // serially in the Electron main process, so two tickets never race.
      printReceipt(html, printOptionsFor(station, { width: 80 }));
      await new Promise((r) => setTimeout(r, 150));
    }

    return byStation.size;
  }

  /* Reprint the tickets for everything already sent - for when a slip jams,
     smudges, or the kitchen loses it. Marked REPRINT so nobody cooks twice. */
  async function handleReprintTickets() {
    if (!state.activeOrder) return;
    const sent = (state.activeOrder.items ?? []).filter((i) => i.status === 'SENT');
    if (sent.length === 0) {
      toast.warning('مفيش أصناف متبعتة للطباعة.');
      return;
    }
    const count = await printStationTickets(sent, 'REPRINT');
    toast.success(count > 1 ? 'تم إعادة طباعة بونين (مطبخ + بار).' : 'تم إعادة طباعة البون.');
  }

  /* ── Send to kitchen ── */
  async function handleSend() {
    if (!state.activeOrder) return;
    // Never print a ticket while a line is still being written to the server.
    if ((state.activeOrder.items ?? []).some(isTempItem)) {
      toast.warning('استنى لحظة، لسه في صنف بيتسجل.');
      return;
    }
    dispatch({ type: 'LOADING_ORDER', payload: true });
    try {
      const itemsToSend = state.activeOrder.items?.filter(i => i.status === 'NEW' || i.status === 'PENDING') || [];
      if (itemsToSend.length > 0) {
        const stations = await printStationTickets(
          itemsToSend,
          state.activeOrder.status === 'OPEN' ? 'NEW' : 'ADDITION'
        );
        if (stations > 1) toast.info('اتطبع بون للمطبخ وبون تاني للبار.');
      }

      const updated = await ordersApi.send(state.activeOrder.id);
      sounds.playKitchen();
      dispatch({ type: 'SET_ORDER', payload: updated });
      toast.success(DONE.SEND);
      await loadOrders();
      // Stock is deducted server-side on send(); refetch so the on-screen counts (and
      // auto-unavailable flips at zero) reflect it immediately instead of only after F5.
      await loadMenu(state.categories);
    } catch (err) {
      sounds.playError();
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
      toast.success(serveDone(updated?.type ?? state.activeOrder?.type));
      await loadOrders();
    } catch (err) {
      toast.error(err.message, 'فشل في تحديث حالة الأوردر');
    } finally {
      dispatch({ type: 'LOADING_ORDER', payload: false });
    }
  }

  /* ── Cancel Order ── */
  async function handleCancelOrder() {
    if (!state.activeOrder) return;
    // Only allow if order not already closed or cancelled
    if (['CLOSED', 'VOIDED'].includes(state.activeOrder.status)) return;
    try {
      const updated = await ordersApi.voidOrder(state.activeOrder.id, { reason: 'إلغاء الأوردر' });
      sounds.playError();
      dispatch({ type: 'SET_ORDER', payload: updated });
      toast.success('الأوردر تم إلغاؤه.');
      await loadOrders();
      // clear active table/order
      dispatch({ type: 'CLEAR_TABLE' });
    } catch (err) {
      sounds.playError();
      toast.error(err.message, 'فشل في إلغاء الأوردر');
    }
  }

  /* ── Cancel item ──
     For lines the kitchen has already started. Audited: keeps a CANCELLED row with a reason and
     prints a cancellation slip. */
  async function handleCancelItem(itemId, reason) {
    if (!state.activeOrder) return;
    try {
      const item = (state.activeOrder.items ?? []).find((i) => i.id === itemId);
      const updated = await ordersApi.cancelItem(state.activeOrder.id, itemId, { reason });
      sounds.playError();
      dispatch({ type: 'SET_ORDER', payload: updated });
      if (item?.productId) {
        const qty = item.quantity || 1;
        dispatch({
          type: 'RESTORE_PRODUCT_STOCK',
          payload: { productId: item.productId, quantity: qty },
        });
      }
      toast.success('الصنف اتلغى.');
      await loadOrders();
    } catch (err) {
      toast.error(err.message, 'فشل في إلغاء الصنف');
    }
  }

  /* ── Remove an unsent item ──
     The everyday correction: a mistap the kitchen never saw. Deletes the line outright, with no
     confirmation, no reason, and no entry in the cancellations report - that report exists to
     surface suspicious activity, and burying ordinary typos in it is what taught cashiers to be
     nervous. Re-adding is a single tap on the same product, so there's nothing to lose. */
  async function handleRemoveItem(itemId) {
    if (!state.activeOrder) return;
    try {
      const item = (state.activeOrder.items ?? []).find((i) => i.id === itemId);
      const updated = await ordersApi.removeItem(state.activeOrder.id, itemId);
      dispatch({ type: 'SET_ORDER', payload: updated });
      if (item?.productId) {
        const qty = item.quantity || 1;
        dispatch({
          type: 'RESTORE_PRODUCT_STOCK',
          payload: { productId: item.productId, quantity: qty },
        });
      }
      if (itemId === lastAddedItemId) setLastAddedItemId(null);
      loadOrders();
    } catch (err) {
      toast.error(err.message, 'فشل في شيل الصنف');
    }
  }

  /* ── After payment recorded (fully paid + closed, or just a partial payment) ── */
  async function handlePaymentSuccess(updatedOrder, fullyPaid) {
    setShowPayment(false);
    setShiftRefreshKey((k) => k + 1);
    sounds.playPaymentSuccess();

    if (fullyPaid) {
      toast.success(DONE.PAY);
      const html = buildReceiptHtml({ order: updatedOrder || state.activeOrder });
      printReceipt(html, printOptionsFor('RECEIPT', { width: 80 }));
      dispatch({ type: 'CLEAR_TABLE' });
    } else {
      // Order stays open with a reduced balance - keep it active so the cashier can collect
      // the rest, instead of clearing the table as if the sale were finished.
      dispatch({ type: 'SET_ORDER', payload: updatedOrder });
    }

    await loadTables();
    await loadOrders();
  }

  /* ── Add Water ── */
  async function handleAddWater() {
    if (!state.activeOrder) return;
    
    try {
      const allProds = await menuApi.getProducts();
      const waterProd = allProds.find(p => {
        const nameAr = (p.nameAr || '').toLowerCase();
        const nameEn = (p.nameEn || '').toLowerCase();
        const name = (p.name || '').toLowerCase();
        return nameAr.includes('مياه') || nameEn.includes('water') || name.includes('مياه') || nameAr.includes('Ù…ÙŠØ§Ù‡');
      });

      if (!waterProd) {
        toast.error('صنف المياه غير موجود بالمنيو');
        return;
      }
      const updated = await ordersApi.addItem(state.activeOrder.id, {
        productId: waterProd.id,
        quantity: 1
      });
      dispatch({ type: 'SET_ORDER', payload: updated });
      toast.success('تم إضافة مياه للفاتورة بنجاح!');
      await loadOrders();
    } catch (err) {
      toast.error(err.message, 'فشل في إضافة المياه');
    }
  }

  /* ── Set Delivery Fee (takeaway only) ── */
  async function handleSetDeliveryFee(amount) {
    if (!state.activeOrder) return;
    try {
      const updated = await ordersApi.setDeliveryFee(state.activeOrder.id, amount);
      dispatch({ type: 'SET_ORDER', payload: updated });
      toast.success('تم تحديث رسوم التوصيل بنجاح');
      await loadOrders();
    } catch (err) {
      toast.error(err.message, 'فشل في تحديث رسوم التوصيل');
    }
  }

  /* ── Discount Handlers ── */
  async function handleApplyDiscount(data) {
    if (!state.activeOrder) return;
    try {
      const updated = await ordersApi.applyDiscount(state.activeOrder.id, data);
      dispatch({ type: 'SET_ORDER', payload: updated });
      toast.success('تم تطبيق الخصم بنجاح');
      await loadOrders();
    } catch (err) {
      toast.error(err.message, 'فشل في تطبيق الخصم');
    }
  }

  async function handleClearDiscount() {
    if (!state.activeOrder) return;
    try {
      const updated = await ordersApi.clearDiscount(state.activeOrder.id);
      dispatch({ type: 'SET_ORDER', payload: updated });
      toast.success('تم إلغاء الخصم بنجاح');
      await loadOrders();
    } catch (err) {
      toast.error(err.message, 'فشل في إلغاء الخصم');
    }
  }

  /* ── Service Fee Handlers ── */
  async function handleApplyServiceFee(amount) {
    if (!state.activeOrder) return;
    try {
      const updated = await ordersApi.setServiceFee(state.activeOrder.id, amount);
      dispatch({ type: 'SET_ORDER', payload: updated });
      toast.success('تم تطبيق رسوم الخدمة بنجاح');
      await loadOrders();
    } catch (err) {
      toast.error(err.message, 'فشل في تطبيق رسوم الخدمة');
    }
  }

  async function handleClearServiceFee() {
    if (!state.activeOrder) return;
    try {
      const updated = await ordersApi.clearServiceFee(state.activeOrder.id);
      dispatch({ type: 'SET_ORDER', payload: updated });
      toast.success('تم إلغاء رسوم الخدمة بنجاح');
      await loadOrders();
    } catch (err) {
      toast.error(err.message, 'فشل في إلغاء رسوم الخدمة');
    }
  }

  /* ── Keyboard shortcuts ──
     Digits set a quantity multiplier for the next tap, F4 sends, F8 opens
     payment, Ctrl+Z undoes the last line. All of them are ignored while a
     dialog is open or the cashier is typing. */
  useEffect(() => {
    function onKeyDown(e) {
      if (anyModalOpen) return;
      const el = e.target;
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable)) {
        return;
      }

      if (e.ctrlKey && (e.key === 'z' || e.key === 'Z')) {
        if (canUndo) { e.preventDefault(); handleUndoLastItem(); }
        return;
      }
      if (e.ctrlKey || e.altKey || e.metaKey) return;

      if (/^[1-9]$/.test(e.key)) {
        e.preventDefault();
        setMultiplier(parseInt(e.key, 10));
        return;
      }
      if (e.key === 'Escape') { setMultiplier(1); return; }
      if (e.key === 'F4') {
        e.preventDefault();
        if (state.activeOrder) handleSend();
        return;
      }
      if (e.key === 'F8') {
        e.preventDefault();
        if (state.activeOrder && num(state.activeOrder.balanceDue) > 0) setShowPayment(true);
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  });

  /* ── Keep table colours, takeaway orders, and product availability live ──
     Read-only refresh; it never touches the order the cashier is editing. The menu leg is what
     lets one cashier's reservation (see addToOrder) show up as reduced availability on every
     other open register within 20s, without needing a push channel. */
  useEffect(() => {
    if (!state.activeShift) return undefined;

    function refresh() {
      if (document.hidden || anyModalOpen) return;
      loadOrders();
      loadTables();
      loadMenu(state.categories);
    }
    const timer = setInterval(refresh, 20000);
    window.addEventListener('focus', refresh);
    return () => {
      clearInterval(timer);
      window.removeEventListener('focus', refresh);
    };
  }, [state.activeShift, anyModalOpen, loadOrders, loadTables, loadMenu, state.categories]);

  if (isLoadingShift) return <div className="page" style={{display: 'flex', justifyContent: 'center', alignItems: 'center'}}><div className="spinner"></div></div>;

  if (!state.activeShift) {
    // Only cashiers open shifts - keeps drawer/cash accountability tied to the person actually
    // running the register, not whoever happens to be logged in. Backend enforces the same rule
    // (ShiftController.open is @PreAuthorize("hasRole('CASHIER')")); this just avoids showing
    // admins/supervisors a form that would 403 on submit.
    if (role !== ROLES.CASHIER) {
      return (
        <div className="pos" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
          <div className="pos__open-modal" style={{ maxWidth: '400px', textAlign: 'center' }}>
            <h2 style={{ marginBottom: 'var(--space-3)' }}>مفيش شيفت مفتوح</h2>
            <p style={{ color: 'var(--text-secondary)' }}>فتح الشيفت متاح للكاشير بس، عشان الدرج يفضل مسؤولية شخص واحد.</p>
          </div>
        </div>
      );
    }
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
    <div className="pos-shell">
      {/* Live shift read-out: sales, split, and what the drawer should hold */}
      <ShiftStrip
        shift={state.activeShift}
        refreshKey={shiftRefreshKey}
        onCloseShift={() => setShowCloseShift(true)}
      />

      <div className="pos">
      {/* LEFT — Tables */}
      <TableGrid
        tables={state.tables}
        orders={state.activeOrders}
        activeTable={state.activeTable}
        activeOrder={state.activeOrder}
        loading={state.isLoadingTables}
        collapsed={tablesCollapsed}
        onToggleCollapse={() => setTablesCollapsed((v) => !v)}
        onTableClick={handleTableClick}
        onTakeawayClick={(order) => dispatch({ type: 'SELECT_ORDER', payload: order })}
        onNewTakeawayClick={() => setOpenTakeawayModal(true)}
        onCloseShift={() => setShowCloseShift(true)}
      />

      {/* CENTER — Menu */}
      <MenuPanel
        categories={state.categories}
        products={state.products}
        topProducts={state.topProducts}
        quickAccessProducts={quickAccessProducts}
        loading={state.isLoadingMenu}
        multiplier={multiplier}
        onProductClick={handleAddProduct}
        onProductDetails={handleProductDetails}
      />

      {/* RIGHT — Order */}
      <OrderPanel
        table={state.activeTable}
        order={state.activeOrder}
        loading={state.isLoadingOrder}
        products={state.products}
        onSend={handleSend}
        onServe={handleServe}
        onCancelItem={handleCancelItem}
        onRemoveItem={handleRemoveItem}
        onCancelOrder={handleCancelOrder}
        onPayClick={() => setShowPayment(true)}
        onAddWater={handleAddWater}
        onIncreaseItem={handleIncreaseItem}
        syncing={isSyncing}
        canUndo={canUndo}
        onUndoLastItem={handleUndoLastItem}
        onReprintTickets={handleReprintTickets}
        onSetDeliveryFee={handleSetDeliveryFee}
        onApplyDiscount={handleApplyDiscount}
        onClearDiscount={handleClearDiscount}
        onApplyServiceFee={handleApplyServiceFee}
        onClearServiceFee={handleClearServiceFee}
        onMoveTable={() => {
          setTargetTableId('');
          setShowMoveModal(true);
        }}
      />
      </div>

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

      {/* Open Takeaway / Delivery Modal */}
      {openTakeawayModal && (
        <div className="pos__open-modal-overlay" onClick={() => setOpenTakeawayModal(false)}>
          <div className="pos__takeaway-modal" onClick={(e) => e.stopPropagation()}>
            <div style={{ textAlign: 'center', marginBottom: '4px' }}>
              <h3 style={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--fw-bold)', color: 'var(--text-primary)', margin: 0 }}>
                {takeawayMode === 'DIRECT' ? '🛍️ أوردر تيك أواي جديد' : '🛵 أوردر دليفري جديد'}
              </h3>
            </div>

            {/* Mode Tabs */}
            <div className="pos__takeaway-tabs">
              <button
                type="button"
                className={`pos__takeaway-tab-btn ${takeawayMode === 'DIRECT' ? 'pos__takeaway-tab-btn--active' : ''}`}
                onClick={() => {
                  setTakeawayMode('DIRECT');
                  setMatchedCustomer(null);
                }}
              >
                <ShoppingBag size={14} />
                تيك أواي عادي
              </button>
              <button
                type="button"
                className={`pos__takeaway-tab-btn ${takeawayMode === 'DELIVERY' ? 'pos__takeaway-tab-btn--active' : ''}`}
                onClick={() => setTakeawayMode('DELIVERY')}
              >
                <Bike size={14} />
                دليفري وتوصيل
              </button>
            </div>

            <form onSubmit={handleOpenTakeawayOrder} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {takeawayMode === 'DIRECT' ? (
                <>
                  <div style={{ padding: '8px 10px', background: 'rgba(245, 158, 11, 0.08)', borderRadius: 'var(--radius-md)', border: '1px dashed rgba(245, 158, 11, 0.3)', fontSize: '11.5px', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                    ⚡ <strong>تيك أواي مباشر:</strong> افتح الأوردر فوراً واستلم من الكاونتر بدون أي بيانات مطلوبة.
                  </div>
                  <div className="field">
                    <label className="field__label">اسم أو رقم العميل (اختياري)</label>
                    <input
                      type="text"
                      list="pos-customer-names"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      className="field__input field__wrapper"
                      placeholder="مثال: أحمد صبري أو اتركه فارغاً"
                      autoFocus
                    />
                    <datalist id="pos-customer-names">
                      {state.customers.map((c) => (
                        <option key={c.phone || c.name} value={c.name}>
                          {c.phone || ''}
                        </option>
                      ))}
                    </datalist>
                  </div>
                </>
              ) : (
                <>
                  {/* Delivery Mode */}
                  <div className="field">
                    <label className="field__label" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Phone size={12} style={{ color: 'var(--accent)' }} />
                      <span>رقم موبايل العميل (للبحث أو الحفظ) *</span>
                    </label>
                    <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                      <input
                        type="tel"
                        required
                        value={customerPhone}
                        onChange={(e) => handlePhoneChange(e.target.value)}
                        className="field__input field__wrapper"
                        placeholder="اكتب رقم الموبايل (مثال: 010...)"
                        autoFocus
                        style={{ paddingInlineStart: '32px' }}
                      />
                      <Search size={14} style={{ position: 'absolute', insetInlineStart: '10px', color: 'var(--text-muted)' }} />
                    </div>
                  </div>

                  {/* Customer Match Status */}
                  {matchedCustomer ? (
                    <div className="pos__customer-match-badge pos__customer-match-badge--found">
                      <UserCheck size={14} />
                      <span>عميل مسجل: <strong>{matchedCustomer.name || 'عميل'}</strong></span>
                    </div>
                  ) : customerPhone.trim().length >= 7 ? (
                    <div className="pos__customer-match-badge pos__customer-match-badge--new">
                      <UserPlus size={14} />
                      <span>عميل جديد — سيتم حفظ بياناته تلقائياً للمرات القادمة</span>
                    </div>
                  ) : null}

                  <div className="field">
                    <label className="field__label">اسم العميل *</label>
                    <input
                      type="text"
                      required
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      className="field__input field__wrapper"
                      placeholder="اسم المستلم"
                    />
                  </div>

                  <div className="field">
                    <label className="field__label" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <MapPin size={12} style={{ color: 'var(--accent)' }} />
                      <span>عنوان التوصيل بالتفصيل *</span>
                    </label>
                    <textarea
                      required
                      rows={2}
                      value={customerAddress}
                      onChange={(e) => setCustomerAddress(e.target.value)}
                      className="field__input field__wrapper"
                      placeholder="المنطقة، اسم الشارع، رقم العمارة، الدور، الشقة، علامة مميزة..."
                      style={{ resize: 'vertical', minHeight: '48px', paddingTop: '6px' }}
                    />
                  </div>

                  <div className="field">
                    <label className="field__label">رسوم التوصيل (ج.م)</label>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={deliveryFee}
                      onChange={(e) => setDeliveryFee(e.target.value)}
                      className="field__input field__wrapper"
                      placeholder="مثال: 15"
                    />
                  </div>
                </>
              )}

              <div className="pos__open-actions" style={{ marginTop: '6px' }}>
                <button type="button" className="btn btn--secondary btn--md" onClick={() => setOpenTakeawayModal(false)}>
                  إلغاء
                </button>
                <button type="submit" className="btn btn--primary btn--md" style={{ flex: 1 }}>
                  {takeawayMode === 'DIRECT' ? (
                    <><ShoppingBag size={14} /> فتح أوردر تيك أواي ⚡</>
                  ) : (
                    <><Bike size={14} /> فتح أوردر دليفري 🛵</>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Move/Merge Modal */}
      {showMoveModal && state.activeOrder && state.activeTable && (
        <div className="pos__open-modal-overlay" onClick={() => setShowMoveModal(false)}>
          <div className="pos__open-modal" onClick={(e) => e.stopPropagation()}>
            <h3 style={{ marginBottom: 'var(--space-4)', textAlign: 'center' }}>نقل/دمج طاولة {state.activeTable.number}</h3>
            <form onSubmit={handleMoveTable} className="form-grid">
              <div className="field" style={{ gridColumn: '1/-1' }}>
                <label className="field__label">اختر الطاولة الهدف</label>
                <select 
                  className="field-select__control" 
                  value={targetTableId} 
                  onChange={(e) => setTargetTableId(e.target.value)} 
                  required
                >
                  <option value="">-- اختار الترابيزة --</option>
                  {state.tables.filter(t => t.id !== state.activeTable.id && t.active).map(t => {
                    const isOccupied = state.activeOrders.some(
                      o => o.tableId === t.id && (o.status === 'OPEN' || o.status === 'SENT' || o.status === 'SERVED')
                    );
                    return (
                      <option key={t.id} value={t.id}>
                        ترابيزة {t.number} {isOccupied ? '(مشغولة - دمج)' : '(فارغة - نقل)'}
                      </option>
                    );
                  })}
                </select>
              </div>
              <div className="pos__open-actions" style={{ gridColumn: '1/-1', marginTop: 'var(--space-2)' }}>
                <button type="button" className="btn btn--secondary btn--md" onClick={() => setShowMoveModal(false)}>إلغاء</button>
                <button type="submit" className="btn btn--primary btn--md">تأكيد</button>
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

      {/* Product modifiers (sizes / extras) - only for products that actually have them */}
      {showPosOptionsModal && posOptionsProduct && (
        <ModifierDialog
          product={posOptionsProduct}
          options={posOptionsList}
          selectedIds={selectedOptionIds}
          onToggle={(optionId) =>
            setSelectedOptionIds((prev) =>
              prev.includes(optionId) ? prev.filter((id) => id !== optionId) : [...prev, optionId]
            )
          }
          quantity={addQuantity}
          onQuantityChange={setAddQuantity}
          note={addNote}
          onNoteChange={setAddNote}
          onMarkUnavailable={
            role === ROLES.ADMIN || role === ROLES.SUPERVISOR
              ? () => handleMarkUnavailable(posOptionsProduct)
              : undefined
          }
          onCancel={() => {
            setShowPosOptionsModal(false);
            setPosOptionsProduct(null);
            setAddQuantity(1);
            setAddNote('');
          }}
          onConfirm={handleAddProductWithOptions}
        />
      )}

      {/* Close Shift Modal */}
      {showCloseShift && state.activeShift && (() => {
        const activeUnsettled = (state.activeOrders || []).filter(
          o => o.status === 'OPEN' || o.status === 'SENT' || o.status === 'SERVED' || o.status === 'READY_FOR_PICKUP'
        );
        return (
          <div className="pos__open-modal-overlay" onClick={() => setShowCloseShift(false)}>
            <div className="pos__open-modal" style={{ maxWidth: '440px' }} onClick={(e) => e.stopPropagation()}>
              <h3 style={{ textAlign: 'center', marginBottom: 'var(--space-2)' }}>🔒 قفل الشيفت والخزينة</h3>
              <p style={{ textAlign: 'center', fontSize: '12px', color: 'var(--text-muted)', marginBottom: 'var(--space-4)' }}>
                يرجى جرد النقدية الفعلية داخل الدرج قبل إتمام الإغلاق
              </p>

              {activeUnsettled.length > 0 && (
                <div style={{
                  background: 'rgba(239, 68, 68, 0.12)',
                  border: '1px solid rgba(239, 68, 68, 0.35)',
                  color: '#ef4444',
                  padding: '10px 12px',
                  borderRadius: '8px',
                  fontSize: '12.5px',
                  fontWeight: 600,
                  marginBottom: '14px',
                  lineHeight: '1.5'
                }}>
                  ⚠️ <b>تنبيه هام:</b> يوجد عدد ({activeUnsettled.length}) طلب مفتوح أو غير مدفوع على الطاولات/التيك أواي. يجب محاسبة جميع الطلبات أو إلغاؤها أولاً لتتمكن من قفل الشيفت.
                </div>
              )}

              <div style={{
                background: 'rgba(255, 255, 255, 0.04)',
                border: '1px solid var(--border-color)',
                padding: '10px 12px',
                borderRadius: '8px',
                marginBottom: '14px',
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: '12.5px'
              }}>
                <span>العهدة الافتتاحية للدرج:</span>
                <strong style={{ color: 'var(--accent)' }}>{formatCurrency(state.activeShift.openingFloat || 0)}</strong>
              </div>

              <form onSubmit={handleCloseShift} className="form-grid">
                <div className="field" style={{ gridColumn: '1/-1' }}>
                  <label className="field__label">الكاش الفعلي في الدرج (المعدود يدوياً) *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    placeholder="أدخل مبلغ النقدية الموجود بالدرج"
                    className="field__input field__wrapper"
                    value={closeShiftForm.countedCash}
                    onChange={e => setCloseShiftForm(prev => ({ ...prev, countedCash: e.target.value }))}
                    autoFocus
                  />
                </div>
                <div className="field" style={{ gridColumn: '1/-1' }}>
                  <label className="field__label">🍿 صافي السناكس اليومي (اختياري)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="أدخل مبلغ صافي السناكس إن وجد"
                    className="field__input field__wrapper"
                    value={closeShiftForm.snacksNet}
                    onChange={e => setCloseShiftForm(prev => ({ ...prev, snacksNet: e.target.value }))}
                  />
                </div>
                <div className="pos__open-actions" style={{ gridColumn: '1/-1', display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '8px' }}>
                  <button type="button" className="btn btn--secondary btn--md" onClick={() => setShowCloseShift(false)}>إلغاء</button>
                  <button
                    type="submit"
                    className="btn btn--primary btn--md"
                    style={{ background: activeUnsettled.length > 0 ? '#9ca3af' : 'var(--danger)', cursor: activeUnsettled.length > 0 ? 'not-allowed' : 'pointer' }}
                  >
                    تأكيد قفل الشيفت 🔒
                  </button>
                </div>
              </form>
            </div>
          </div>
        );
      })()}
      {/* Opening Shift Inventory Audit Modal */}
      {showOpeningAudit && state.activeShift && (
        <ShiftAuditModal
          isOpen={showOpeningAudit}
          onClose={() => setShowOpeningAudit(false)}
          shiftId={state.activeShift.id}
          mode="OPENING"
        />
      )}

      {/* Closing Shift Inventory Audit & Waste Analysis Modal */}
      {showClosingAudit && (
        <ShiftAuditModal
          isOpen={showClosingAudit}
          onClose={() => setShowClosingAudit(false)}
          shiftId={state.activeShift?.id || 1}
          mode="CLOSING"
        />
      )}

      {/* Quick Refill Stock Modal - shown when cashier taps an out-of-stock product */}
      {refillProduct && (() => {
        const isRecipe = Boolean(refillProduct.primaryIngredientName || refillProduct.recipeInventory);
        const ingredientName = refillProduct.primaryIngredientName || 'المادة الخام';
        const ingredientUnit = refillProduct.primaryIngredientUnit || 'جرام';
        const perCup = refillProduct.deductionQuantity || 10;
        const currentRawStock = refillProduct.primaryIngredientStock ?? 0;

        const calculatedCupsFromGrams = Math.floor((parseFloat(refillGrams) || 0) / perCup);
        const calculatedGramsFromCups = (parseInt(refillQty) || 0) * perCup;

        return (
          <div className="pos__open-modal-overlay" onClick={() => setRefillProduct(null)}>
            <div className="pos__open-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '440px' }}>
              <h3 style={{ margin: '0 0 6px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '22px' }}>📦</span> الصنف نفذ من المخزون!
              </h3>

              <div style={{
                background: 'var(--bg-surface)',
                border: '1px solid var(--border-color)',
                borderRadius: '8px',
                padding: '10px 12px',
                marginBottom: '14px'
              }}>
                <div style={{ fontWeight: 'bold', fontSize: '14px', marginBottom: '4px' }}>
                  «{refillProduct.name}»
                </div>
                {isRecipe ? (
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    <span>المادة الخام: <strong style={{ color: 'var(--accent)' }}>{ingredientName}</strong> (المخزون الحالي: <strong style={{ color: currentRawStock <= 0 ? '#ef4444' : '#10b981' }}>{currentRawStock} {ingredientUnit}</strong>)</span>
                    <span>المعيار: <strong>{perCup} {ingredientUnit}</strong> لكل فنجان</span>
                  </div>
                ) : (
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                    المخزون الحالي: <strong style={{ color: '#ef4444' }}>0 قطعة</strong>
                  </div>
                )}
              </div>

              {/* If Recipe: Mode Switcher (Grams vs Cups) */}
              {isRecipe && (
                <div style={{ display: 'flex', gap: '8px', marginBottom: '14px' }}>
                  <button
                    type="button"
                    style={{
                      flex: 1,
                      padding: '8px 12px',
                      borderRadius: '8px',
                      border: '1px solid',
                      borderColor: refillMode === 'GRAMS' ? '#10b981' : 'var(--border-color)',
                      background: refillMode === 'GRAMS' ? 'rgba(16, 185, 129, 0.15)' : 'var(--bg-surface)',
                      color: refillMode === 'GRAMS' ? '#10b981' : 'var(--text-secondary)',
                      fontWeight: '700',
                      fontSize: '13px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px'
                    }}
                    onClick={() => {
                      setRefillMode('GRAMS');
                      if (!refillGrams) setRefillGrams('250');
                    }}
                  >
                    ⚖️ بالجرامات ({ingredientUnit})
                  </button>
                  <button
                    type="button"
                    style={{
                      flex: 1,
                      padding: '8px 12px',
                      borderRadius: '8px',
                      border: '1px solid',
                      borderColor: refillMode === 'PIECES' ? '#10b981' : 'var(--border-color)',
                      background: refillMode === 'PIECES' ? 'rgba(16, 185, 129, 0.15)' : 'var(--bg-surface)',
                      color: refillMode === 'PIECES' ? '#10b981' : 'var(--text-secondary)',
                      fontWeight: '700',
                      fontSize: '13px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px'
                    }}
                    onClick={() => {
                      setRefillMode('PIECES');
                      if (!refillQty) setRefillQty('25');
                    }}
                  >
                    ☕ بالفناجين / القطع
                  </button>
                </div>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {isRecipe && refillMode === 'GRAMS' ? (
                  /* Grams Input Section */
                  <div>
                    <label style={{ fontSize: '12px', fontWeight: 600, marginBottom: '4px', display: 'block' }}>
                      الكمية بالجرام ({ingredientUnit} بن جديدة وصلت)
                    </label>
                    <input
                      type="number"
                      min="1"
                      className="input"
                      value={refillGrams}
                      onChange={(e) => setRefillGrams(e.target.value)}
                      onFocus={(e) => e.target.select()}
                      autoFocus
                      placeholder="مثلاً 250"
                      style={{ width: '100%', height: '42px', fontSize: '18px', fontWeight: 'bold', textAlign: 'center' }}
                    />

                    {/* Quick Presets for Grams */}
                    <div style={{ display: 'flex', gap: '6px', justifyContent: 'center', marginTop: '8px' }}>
                      {[100, 250, 500, 1000].map((amt) => (
                        <button
                          key={amt}
                          type="button"
                          style={{
                            flex: 1,
                            padding: '6px 8px',
                            fontSize: '12px',
                            borderRadius: '6px',
                            border: '1px solid var(--border-color)',
                            background: parseFloat(refillGrams) === amt ? '#10b981' : 'var(--bg-surface)',
                            color: parseFloat(refillGrams) === amt ? '#fff' : 'var(--text-primary)',
                            cursor: 'pointer',
                            fontWeight: '700',
                          }}
                          onClick={() => setRefillGrams(String(amt))}
                        >
                          {amt} ج
                        </button>
                      ))}
                    </div>

                    {/* Calculation Preview */}
                    <div style={{
                      marginTop: '8px',
                      fontSize: '12px',
                      textAlign: 'center',
                      color: '#10b981',
                      background: 'rgba(16, 185, 129, 0.08)',
                      padding: '6px 10px',
                      borderRadius: '6px',
                      fontWeight: 600
                    }}>
                      💡 {refillGrams || 0} {ingredientUnit} = تكفي لعمل حوالي <strong>{calculatedCupsFromGrams} فنجان قهوة</strong>
                    </div>
                  </div>
                ) : (
                  /* Pieces / Cups Input Section */
                  <div>
                    <label style={{ fontSize: '12px', fontWeight: 600, marginBottom: '4px', display: 'block' }}>
                      {isRecipe ? 'عدد الفناجين / الأكواب الجديدة' : 'كمية التغذية (عدد القطع الجديدة)'}
                    </label>
                    <input
                      type="number"
                      min="1"
                      className="input"
                      value={refillQty}
                      onChange={(e) => setRefillQty(e.target.value)}
                      onFocus={(e) => e.target.select()}
                      autoFocus
                      style={{ width: '100%', height: '42px', fontSize: '18px', fontWeight: 'bold', textAlign: 'center' }}
                    />

                    {/* Quick Presets */}
                    <div style={{ display: 'flex', gap: '6px', justifyContent: 'center', marginTop: '8px' }}>
                      {[5, 10, 15, 20, 25, 30, 50].map((amt) => (
                        <button
                          key={amt}
                          type="button"
                          style={{
                            padding: '4px 10px',
                            fontSize: '12px',
                            borderRadius: '6px',
                            border: '1px solid var(--border-color)',
                            background: parseInt(refillQty) === amt ? '#10b981' : 'var(--bg-surface)',
                            color: parseInt(refillQty) === amt ? '#fff' : 'var(--text-primary)',
                            cursor: 'pointer',
                            fontWeight: '700',
                          }}
                          onClick={() => setRefillQty(String(amt))}
                        >
                          {amt}
                        </button>
                      ))}
                    </div>

                    {isRecipe && (
                      <div style={{
                        marginTop: '8px',
                        fontSize: '12px',
                        textAlign: 'center',
                        color: '#10b981',
                        background: 'rgba(16, 185, 129, 0.08)',
                        padding: '6px 10px',
                        borderRadius: '6px',
                        fontWeight: 600
                      }}>
                        💡 {refillQty || 0} فنجان = يستهلك <strong>{calculatedGramsFromCups} {ingredientUnit} {ingredientName}</strong>
                      </div>
                    )}
                  </div>
                )}

                <div className="pos__open-actions" style={{ marginTop: '10px' }}>
                  <button
                    type="button"
                    className="btn btn--secondary btn--md"
                    onClick={() => setRefillProduct(null)}
                  >
                    إلغاء
                  </button>
                  <button
                    type="button"
                    className="btn btn--primary btn--md"
                    disabled={isSavingRefill}
                    onClick={handleRefillAndAdd}
                    style={{ backgroundColor: '#10b981', borderColor: '#10b981', flex: 2 }}
                  >
                    {isSavingRefill
                      ? 'جاري التغذية...'
                      : (isRecipe && refillMode === 'GRAMS'
                          ? `تغذية ${refillGrams || 0} ${ingredientUnit} وإضافة للأوردر 📦`
                          : `تغذية ${refillQty || 0} قطعة وإضافة للأوردر 📦`)}
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

    </div>
  );
}
