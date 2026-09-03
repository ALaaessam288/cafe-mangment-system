import { useCallback, useEffect, useState, useMemo } from 'react';
import { Wallet, TrendingUp, Utensils, Coffee, Lock, FileText, Plus, Clock, Printer, CheckCircle, Vault } from 'lucide-react';
import { shiftsApi } from '../../api/shiftsApi';
import { expensesApi } from '../../api/expensesApi';
import { menuApi } from '../../api/menuApi';
import { auditApi } from '../../api/auditApi';
import { formatCurrency } from '../../utils/formatters';
import { printExpenseVoucher } from '../../utils/printUtils';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';
import { ROLES } from '../../utils/constants';
import DailyReportModal from '../../components/DailyReportModal/DailyReportModal';
import CashDrawerModal from '../../components/CashDrawerModal/CashDrawerModal';
import Modal from '../../components/Modal/Modal';
import Input from '../../components/Input/Input';
import Button from '../../components/Button/Button';
import Spinner from '../../components/Spinner/Spinner';

function todayISO() {
  return new Date().toISOString().split('T')[0];
}

const EXPENSE_TYPES = {
  MATERIALS: 'خامات ومشتريات',
  RENT: 'إيجارات وشواغر',
  SALARIES: 'رواتب وأجور',
  MAINTENANCE: 'صيانة وإصلاحات',
  INSTALLMENTS: 'أقساط والتزامات'
};

export default function ShiftStrip({ shift, refreshKey, onCloseShift }) {
  const toast = useToast();
  const { role, user } = useAuth();
  const [report, setReport] = useState(null);
  const [showReportModal, setShowReportModal] = useState(false);
  const [showCashDrawerModal, setShowCashDrawerModal] = useState(false);

  const canViewFinancialTotals = role === ROLES.ADMIN || role === ROLES.SUPERVISOR;

  // Quick Expense Modal State inside POS
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [entryMode, setEntryMode] = useState('ADVANCE'); // ADVANCE | DIRECT
  const [expForm, setExpForm] = useState({
    type: 'MATERIALS',
    revenueLine: 'SHARED',
    amount: '',
    notes: '',
    paidFromDrawer: true,
    autoPrint: true
  });
  const [isSubmittingExp, setIsSubmittingExp] = useState(false);

  // Pending Advances List & Settle Modal State inside POS
  const [expenses, setExpenses] = useState([]);
  const [showPendingModal, setShowPendingModal] = useState(false);
  const [selectedAdvance, setSelectedAdvance] = useState(null);
  const [settleActualAmount, setSettleActualAmount] = useState('');
  const [settleNotes, setSettleNotes] = useState('');
  const [isSubmittingSettle, setIsSubmittingSettle] = useState(false);

  // Quick Stock Modal State
  const [showStockModal, setShowStockModal] = useState(false);
  const [stockItems, setStockItems] = useState([]); // combined raw materials & products
  const [loadingStock, setLoadingStock] = useState(false);
  const [adjustAmountMap, setAdjustAmountMap] = useState({}); // { itemId: amount }
  const [refillType, setRefillType] = useState('ALL'); // ALL | MATERIALS | PRODUCTS

  const load = useCallback(async () => {
    if (!shift?.id) return;
    try {
      const [rep, expList] = await Promise.all([
        shiftsApi.getReport(shift.id),
        expensesApi.findAll()
      ]);
      setReport(rep);
      setExpenses(expList || []);
    } catch {
      // Failed refresh won't interrupt order taking
    }
  }, [shift?.id]);

  useEffect(() => { load(); }, [load, refreshKey]);

  useEffect(() => {
    const timer = setInterval(() => { if (!document.hidden) load(); }, 45000);
    return () => clearInterval(timer);
  }, [load]);

  const loadInventoryItems = useCallback(async () => {
    setLoadingStock(true);
    try {
      const [materials, products] = await Promise.all([
        auditApi.getAuditItems().catch(() => []),
        menuApi.getProducts().catch(() => [])
      ]);

      const matsFormatted = (materials || []).map(m => ({
        id: `mat-${m.id}`,
        dbId: m.id,
        name: m.name,
        unit: m.unit,
        stockQuantity: m.stockQuantity,
        minThreshold: m.minThreshold,
        type: 'MATERIAL'
      }));

      const prodsFormatted = (products || [])
        .filter(p => p.trackInventory)
        .map(p => ({
          id: `prod-${p.id}`,
          dbId: p.id,
          name: p.name,
          unit: 'قطعة',
          stockQuantity: p.stockQuantity,
          minThreshold: p.minStockThreshold || 5,
          type: 'PRODUCT'
        }));

      setStockItems([...matsFormatted, ...prodsFormatted]);
    } catch (err) {
      toast.error(err.message, 'فشل تحميل بيانات المخزون');
    } finally {
      setLoadingStock(false);
    }
  }, [toast]);

  useEffect(() => {
    if (showStockModal) {
      loadInventoryItems();
      setAdjustAmountMap({});
    }
  }, [showStockModal, loadInventoryItems]);

  async function handleAdjustStock(item, amountStr) {
    const amount = parseFloat(amountStr);
    if (isNaN(amount) || amount <= 0) {
      toast.warning('الرجاء إدخال كمية صحيحة أكبر من الصفر');
      return;
    }

    try {
      if (item.type === 'MATERIAL') {
        const updated = await auditApi.saveAuditItem({
          id: item.dbId,
          name: item.name,
          unit: item.unit,
          stockQuantity: (item.stockQuantity || 0) + amount,
          minThreshold: item.minThreshold,
          requiresAudit: true,
          active: true
        });
        toast.success(`تمت إضافة ${amount} ${item.unit} لخامة «${item.name}» بنجاح 🎉`);
      } else {
        await menuApi.addStock(item.dbId, Math.round(amount));
        toast.success(`تمت إضافة ${Math.round(amount)} قطعة لمنتج «${item.name}» بنجاح 🎉`);
      }

      setStockItems(prev => prev.map(i => i.id === item.id ? { ...i, stockQuantity: (i.stockQuantity || 0) + amount } : i));
      setAdjustAmountMap(prev => ({ ...prev, [item.id]: '' }));

      // Dispatch event to reload menu in POS page
      window.dispatchEvent(new Event('reload-pos-menu'));
    } catch (err) {
      toast.error(err.message, 'فشل تحديث المخزون');
    }
  }

  // Find pending advances waiting for settlement
  const pendingAdvances = useMemo(() => {
    return expenses.filter(e => e.status === 'PENDING_SETTLEMENT');
  }, [expenses]);

  function handleOpenQuickExpense(mode = 'ADVANCE') {
    setEntryMode(mode);
    setExpForm({
      type: 'MATERIALS',
      revenueLine: 'SHARED',
      amount: '',
      notes: mode === 'ADVANCE' ? 'سحب عُهدة مؤقتة للشرائيات' : '',
      paidFromDrawer: true,
      autoPrint: true
    });
    setShowExpenseModal(true);
  }

  async function handleSaveExpense(e) {
    e.preventDefault();
    if (!expForm.amount || parseFloat(expForm.amount) <= 0) {
      toast.error('يرجى إدخال مبلغ مصروف صحيح');
      return;
    }

    setIsSubmittingExp(true);
    try {
      const created = await expensesApi.create({
        type: expForm.type,
        revenueLine: expForm.revenueLine,
        amount: parseFloat(expForm.amount),
        expenseDate: todayISO(),
        recurring: false,
        isAdvance: entryMode === 'ADVANCE',
        paidFromDrawer: expForm.paidFromDrawer,
        notes: expForm.notes
      });

      toast.success(entryMode === 'ADVANCE' ? 'تم تسجيل سحب العُهدة وطباعة البون 🖨️' : 'تم تسجيل المصروف وطباعة البون 🖨️');
      setShowExpenseModal(false);

      if (expForm.autoPrint) {
        try {
          printExpenseVoucher(created, user?.tenantName);
        } catch (pErr) {
          console.error('POS Print failed:', pErr);
        }
      }

      await load();
    } catch (err) {
      toast.error(err.message, 'فشل في إضافة المصروف');
    } finally {
      setIsSubmittingExp(false);
    }
  }

  function handleOpenSettle(adv) {
    setSelectedAdvance(adv);
    setSettleActualAmount(adv.amount ? String(adv.amount) : '');
    setSettleNotes('');
  }

  async function handleConfirmSettle(e) {
    e.preventDefault();
    if (!selectedAdvance || !settleActualAmount) return;

    const actual = parseFloat(settleActualAmount);
    if (isNaN(actual) || actual < 0) {
      toast.error('يرجى إدخال المبلغ الفعلي المصروف بشكل صحيح');
      return;
    }

    setIsSubmittingSettle(true);
    try {
      const settled = await expensesApi.settle(selectedAdvance.id, {
        actualAmount: actual,
        notes: settleNotes
      });

      toast.success('تمت تسوية العُهدة وإعادة الباقي للدرج بنجاح 🎉');
      setSelectedAdvance(null);

      try {
        printExpenseVoucher(settled, user?.tenantName);
      } catch (pErr) {
        console.error('POS Print failed:', pErr);
      }

      await load();
    } catch (err) {
      toast.error(err.message, 'فشل في تسوية العُهدة');
    } finally {
      setIsSubmittingSettle(false);
    }
  }

  const revenue = Number(report?.totalRevenue ?? 0);
  const cash = Number(report?.totalCash ?? 0);
  const opening = Number(shift?.openingFloat ?? 0);
  const food = Number(report?.foodRevenue ?? 0);
  const buffet = Number(report?.buffetRevenue ?? 0);

  const calculatedReturned = useMemo(() => {
    if (!selectedAdvance) return 0;
    const initial = selectedAdvance.advanceAmount || selectedAdvance.amount || 0;
    const actual = parseFloat(settleActualAmount) || 0;
    return initial - actual;
  }, [selectedAdvance, settleActualAmount]);

  return (
    <>
      <div className="shift-strip">
        <div className="shift-strip__identity">
          <span className="shift-strip__live-dot" />
          <span>
            <strong>الشيفت شغّال {shift?.userFullName || shift?.username ? `(بواسطة: ${shift.userFullName || shift.username})` : ''}</strong>
            {shift?.openedAt && (
              <small>
                {shift?.registerName ? `${shift.registerName} • ` : ''}من {new Date(shift.openedAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
              </small>
            )}
          </span>
        </div>

        {/* Only ADMIN and SUPERVISOR can see live revenue and drawer totals */}
        {canViewFinancialTotals && (
          <div className="shift-strip__metrics">
            <span className="shift-strip__cell">
              <TrendingUp size={13} />
              <span className="shift-strip__label">مبيعات الشيفت</span>
              <strong>{formatCurrency(revenue)}</strong>
            </span>

            <span className="shift-strip__cell">
              <Utensils size={13} />
              <span className="shift-strip__label">مطعم</span>
              <strong>{formatCurrency(food)}</strong>
            </span>

            <span className="shift-strip__cell">
              <Coffee size={13} />
              <span className="shift-strip__label">بوفيه</span>
              <strong>{formatCurrency(buffet)}</strong>
            </span>

            <span className="shift-strip__cell shift-strip__cell--drawer" title="العهدة الافتتاحية + الكاش المحصَّل - المصاريف">
              <Wallet size={13} />
              <span className="shift-strip__label">المفروض في الدرج</span>
              <strong>{formatCurrency(opening + cash)}</strong>
            </span>
          </div>
        )}

        <div className="shift-strip__tools">

        {/* Quick Pending Advances Badge in POS */}
        {pendingAdvances.length > 0 && (
          <button
            type="button"
            className="shift-tool shift-tool--warning pos-pending-badge-btn"
            onClick={() => setShowPendingModal(true)}
            title="يوجد عُهد مؤقتة معلقة بانتظار التسوية قبل قفل الشيفت"
          >
            <Clock size={14} /><span><strong>{pendingAdvances.length} عُهدة معلقة</strong><small>تحتاج تسوية</small></span>
          </button>
        )}

        {/* Quick Cash Drawer & Safe Drop Controls */}
        <button
          type="button"
          className="shift-tool shift-tool--drawer pos-quick-drawer-btn"
          style={{ background: 'rgba(245, 158, 11, 0.12)', borderColor: 'rgba(245, 158, 11, 0.3)', color: '#fbbf24' }}
          onClick={() => setShowCashDrawerModal(true)}
          title="الرقابة على الخزينة: إيداعات وسحوبات وترحيل للخزنة الرئيسية (Safe Drop)"
        >
          <Vault size={14} /><span><strong>حركات الدرج</strong><small>إيداع وترحيل خزنة</small></span>
        </button>

        {/* Quick Add Expense Payout Button */}
        <button
          type="button"
          className="shift-tool shift-tool--expense pos-quick-exp-btn"
          onClick={() => handleOpenQuickExpense('ADVANCE')}
          title="إضافة مصروف عاجل أو سحب عُهدة وطباعة البون"
        >
          <Plus size={14} /><span><strong>مصروف سريع</strong><small>سحب من الدرج</small></span>
        </button>

        {/* Quick Stock Refill Button */}
        <button
          type="button"
          className="shift-tool shift-tool--stock pos-quick-stock-btn"
          onClick={() => setShowStockModal(true)}
          title="تغذية وجرد سريع للمخزون والخامات"
        >
          <Plus size={14} /><span><strong>تغذية المخزون</strong><small>إضافة وجرد</small></span>
        </button>

        {/* Only ADMIN and SUPERVISOR can view/print full Daily Report */}
        {canViewFinancialTotals && (
          <button
            type="button"
            className="shift-tool shift-tool--report"
            onClick={() => setShowReportModal(true)}
            title="عرض وطباعة تقرير اليومية الشامل"
          >
            <FileText size={14} /><span><strong>تقرير اليومية</strong><small>عرض وطباعة</small></span>
          </button>
        )}
        </div>

        <button type="button" className="shift-strip__close" onClick={onCloseShift}>
          <Lock size={14} /><span>قفل الشيفت</span>
        </button>
      </div>

      {/* POS Quick Add Expense Modal */}
      {showExpenseModal && (
        <Modal
          isOpen={showExpenseModal}
          onClose={() => setShowExpenseModal(false)}
          title="إضافة مصروف سريع وطباعة البون 💸"
          icon="💸"
          subtitle="سحب نقدية من درج الشيفت وطباعة بون الإيصال فوراً"
          size="sm"
        >
          <div className="expense-mode-tabs" style={{ marginBottom: '12px' }}>
            <button
              type="button"
              className={`expense-mode-tab ${entryMode === 'ADVANCE' ? 'expense-mode-tab--active' : ''}`}
              onClick={() => setEntryMode('ADVANCE')}
            >
              ⏳ سحب عُهدة مؤقتة (تحت التسوية)
            </button>
            <button
              type="button"
              className={`expense-mode-tab ${entryMode === 'DIRECT' ? 'expense-mode-tab--active' : ''}`}
              onClick={() => setEntryMode('DIRECT')}
            >
              💸 مصروف مباشر
            </button>
          </div>

          <form onSubmit={handleSaveExpense} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <Input
              label="مبلغ المصروف (جنيه) *"
              type="number"
              step="0.01"
              min="0.5"
              placeholder="مثال: 50"
              value={expForm.amount}
              onChange={(e) => setExpForm({ ...expForm, amount: e.target.value })}
              required
              autoFocus
            />

            <Input
              label="بيان وتفاصيل المصروف (ماذا اشتريت؟) *"
              type="text"
              placeholder={entryMode === 'ADVANCE' ? 'مثال: سحب عُهدة لشراء سكر وشاي' : 'مثال: شراء نواتج نظافة'}
              value={expForm.notes}
              onChange={(e) => setExpForm({ ...expForm, notes: e.target.value })}
              required
            />

            <div className="exp-presets" style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              {[20, 50, 100, 200, 500].map((amt) => (
                <button
                  key={amt}
                  type="button"
                  className="exp-preset"
                  onClick={() => setExpForm({ ...expForm, amount: String(amt) })}
                >
                  {amt} ج
                </button>
              ))}
            </div>

            <div className="field-select">
              <label className="field-select__label">بند المصروف</label>
              <select
                className="field-select__control"
                value={expForm.type}
                onChange={(e) => setExpForm({ ...expForm, type: e.target.value })}
              >
                {Object.entries(EXPENSE_TYPES).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
              <input
                type="checkbox"
                id="posAutoPrint"
                checked={expForm.autoPrint}
                onChange={(e) => setExpForm({ ...expForm, autoPrint: e.target.checked })}
              />
              <label htmlFor="posAutoPrint" style={{ fontSize: '12px', fontWeight: 600, color: 'var(--accent)' }}>
                🖨️ طباعة إيصال بون حراري فوراً على الطابعة
              </label>
            </div>

            <div className="form-actions" style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '12px' }}>
              <Button variant="secondary" onClick={() => setShowExpenseModal(false)} type="button">إلغاء</Button>
              <Button type="submit" loading={isSubmittingExp}>
                إضافة وطباعة البون 🖨️
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* POS Pending Advances Settlement Modal */}
      {showPendingModal && (
        <Modal
          isOpen={showPendingModal}
          onClose={() => { setShowPendingModal(false); setSelectedAdvance(null); }}
          title="العُهد المعلقة تحت التسوية ⏳"
          icon="⏳"
          subtitle="تسوية العُهد وإرجاع الباقي لدرج الشيفت قبل القفل"
          size="md"
        >
          {selectedAdvance ? (
            <form onSubmit={handleConfirmSettle} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div className="settle-summary-box">
                <div className="settle-summary-row">
                  <span>العُهدة رقم: <b>EXP-{String(selectedAdvance.id).padStart(5, '0')}</b></span>
                  <span>المبلغ المسحوب: <b>{formatCurrency(selectedAdvance.advanceAmount || selectedAdvance.amount)}</b></span>
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                  البيان: {selectedAdvance.notes || 'سحب عُهدة مؤقتة'}
                </div>
              </div>

              <Input
                label="المبلغ الفعلي المصروف (من فاتورة الشراء) *"
                type="number"
                step="0.01"
                min="0"
                max={selectedAdvance.advanceAmount || selectedAdvance.amount}
                value={settleActualAmount}
                onChange={(e) => setSettleActualAmount(e.target.value)}
                required
                autoFocus
              />

              <Input
                label="ملاحظات التسوية"
                type="text"
                placeholder="مثال: تم إعادة 10 جنيه للدرج مع الفاتورة"
                value={settleNotes}
                onChange={(e) => setSettleNotes(e.target.value)}
              />

              {/* Calculation Preview */}
              <div className="settle-calc-card">
                <div className="settle-calc-item">
                  <span>المستغرق الفعلي:</span>
                  <strong>{formatCurrency(parseFloat(settleActualAmount) || 0)}</strong>
                </div>
                <div className="settle-calc-item settle-calc-item--highlight">
                  <span>المبلغ المرتجع لدرج الخزينة:</span>
                  <strong style={{ color: calculatedReturned >= 0 ? '#16a34a' : '#dc2626' }}>
                    +{formatCurrency(calculatedReturned)}
                  </strong>
                </div>
              </div>

              <div className="form-actions" style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '12px' }}>
                <Button variant="secondary" onClick={() => setSelectedAdvance(null)} type="button">رجوع</Button>
                <Button type="submit" loading={isSubmittingSettle} style={{ backgroundColor: '#16a34a', borderColor: '#16a34a' }}>
                  تأكيد التسوية وإعادة الباقي للدرج 🧾
                </Button>
              </div>
            </form>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {pendingAdvances.map(adv => (
                <div key={adv.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', background: 'rgba(30,41,59,0.5)', borderRadius: '8px', border: '1px solid var(--border-default)' }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '13px' }}>
                      EXP-{String(adv.id).padStart(5, '0')} — <span style={{ color: '#f59e0b' }}>{formatCurrency(adv.amount)}</span>
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                      {adv.notes || 'عُهدة تحت التسوية'}
                    </div>
                  </div>
                  <Button size="sm" onClick={() => handleOpenSettle(adv)} style={{ backgroundColor: '#fef3c7', color: '#92400e', borderColor: '#f59e0b' }}>
                    <CheckCircle size={13} style={{ marginInlineEnd: '4px' }} /> تسوية الآن
                  </Button>
                </div>
              ))}
            </div>
          )}
        </Modal>
      )}

      {showReportModal && shift?.id && canViewFinancialTotals && (
        <DailyReportModal
          isOpen={showReportModal}
          onClose={() => setShowReportModal(false)}
          shiftId={shift.id}
        />
      )}

      {/* Quick Stock Refill Modal */}
      {showStockModal && (
        <Modal
          isOpen={showStockModal}
          onClose={() => setShowStockModal(false)}
          title="تغذية المخزون وجرد سريع 📦"
          icon="📦"
          subtitle="تغذية خامات ومشروبات الكافيه بشكل عاجل لملء شريط التقدم"
          size="md"
        >
          <div className="pos-quick-stock-container" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Filter Tabs */}
            <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
              <button
                type="button"
                className={`btn btn--sm ${refillType === 'ALL' ? 'btn--primary' : 'btn--secondary'}`}
                onClick={() => setRefillType('ALL')}
              >
                الكل
              </button>
              <button
                type="button"
                className={`btn btn--sm ${refillType === 'MATERIALS' ? 'btn--primary' : 'btn--secondary'}`}
                onClick={() => setRefillType('MATERIALS')}
              >
                الخامات (القهوة، اللبن...)
              </button>
              <button
                type="button"
                className={`btn btn--sm ${refillType === 'PRODUCTS' ? 'btn--primary' : 'btn--secondary'}`}
                onClick={() => setRefillType('PRODUCTS')}
              >
                المنتجات الجاهزة (المعلبات، الحلويات...)
              </button>
            </div>

            {/* List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '350px', overflowY: 'auto', paddingRight: '4px' }}>
              {loadingStock ? (
                <div style={{ textAlign: 'center', padding: '24px' }}><Spinner /></div>
              ) : stockItems.length === 0 ? (
                <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '24px' }}>لا توجد خامات أو منتجات لتتتبع المخزون حالياً.</div>
              ) : (
                stockItems
                  .filter(item => {
                    if (refillType === 'MATERIALS') return item.type === 'MATERIAL';
                    if (refillType === 'PRODUCTS') return item.type === 'PRODUCT';
                    return true;
                  })
                  .map(item => {
                    const isLow = item.stockQuantity <= item.minThreshold;
                    return (
                      <div
                        key={item.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '12px',
                          background: 'var(--bg-card)',
                          borderRadius: '8px',
                          border: isLow ? '1px solid rgba(239, 68, 68, 0.35)' : '1px solid var(--border-color)',
                          boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                        }}
                      >
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                          <span style={{ fontWeight: 600, fontSize: '13px' }}>
                            {item.name}
                            {isLow && <span style={{ color: '#ef4444', marginInlineStart: '6px', fontSize: '10px', fontWeight: 'bold' }}>⚠️ منخفض!</span>}
                          </span>
                          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                            المخزون الحالي: <strong style={{ color: isLow ? '#ef4444' : '#10b981' }}>{item.stockQuantity} {item.unit}</strong> (الحد الأدنى: {item.minThreshold})
                          </span>
                        </div>

                        {/* Quick Refill Input */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <input
                            type="number"
                            placeholder="الكمية المضافة"
                            value={adjustAmountMap[item.id] || ''}
                            onChange={(e) => setAdjustAmountMap(prev => ({ ...prev, [item.id]: e.target.value }))}
                            style={{
                              width: '80px',
                              height: '32px',
                              padding: '0 8px',
                              borderRadius: '6px',
                              border: '1px solid var(--border-color)',
                              background: 'var(--bg-input)',
                              color: 'var(--text-primary)',
                              fontSize: '13px'
                            }}
                          />
                          <Button
                            size="sm"
                            style={{ height: '32px', padding: '0 10px', backgroundColor: '#10b981', borderColor: '#10b981' }}
                            onClick={() => handleAdjustStock(item, adjustAmountMap[item.id])}
                          >
                            + إضافة
                          </Button>
                        </div>
                      </div>
                    );
                  })
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '8px' }}>
              <Button variant="secondary" onClick={() => setShowStockModal(false)}>إغلاق</Button>
            </div>
          </div>
        </Modal>
      )}

      {/* POS Cash Drawer Controls Modal */}
      {showCashDrawerModal && (
        <CashDrawerModal
          isOpen={showCashDrawerModal}
          onClose={() => {
            setShowCashDrawerModal(false);
            load();
          }}
          currentShift={shift}
        />
      )}
    </>
  );
}
