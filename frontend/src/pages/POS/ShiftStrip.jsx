import { useCallback, useEffect, useState, useMemo } from 'react';
import { Wallet, Receipt, TrendingUp, Utensils, Coffee, Lock, FileText, Plus, Clock, Printer, CheckCircle } from 'lucide-react';
import { shiftsApi } from '../../api/shiftsApi';
import { expensesApi } from '../../api/expensesApi';
import { formatCurrency } from '../../utils/formatters';
import { printExpenseVoucher } from '../../utils/printUtils';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';
import DailyReportModal from '../../components/DailyReportModal/DailyReportModal';
import Modal from '../../components/Modal/Modal';
import Input from '../../components/Input/Input';
import Button from '../../components/Button/Button';

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
  const { user } = useAuth();
  const [report, setReport] = useState(null);
  const [showReportModal, setShowReportModal] = useState(false);

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

  const load = useCallback(async () => {
    if (!shift?.id) return;
    try {
      const [rep, expList] = await Promise.all([
        shiftsApi.getReport(shift.id),
        expensesApi.findAll()
      ]);
      setReport(rep);
      // Filter expenses associated with this shift or pending settlement
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

        {shift?.openedAt && (
          <span className="shift-strip__cell shift-strip__cell--muted">
            <Receipt size={13} />
            <span className="shift-strip__label">بدأ</span>
            <strong>{new Date(shift.openedAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</strong>
          </span>
        )}

        {/* Quick Pending Advances Badge in POS */}
        {pendingAdvances.length > 0 && (
          <button
            type="button"
            className="btn btn--secondary btn--sm pos-pending-badge-btn"
            onClick={() => setShowPendingModal(true)}
            title="يوجد عُهد مؤقتة معلقة بانتظار التسوية قبل قفل الشيفت"
          >
            <Clock size={13} /> {pendingAdvances.length} عُهدة معلقة ⏳
          </button>
        )}

        {/* Quick Add Expense Payout Button */}
        <button
          type="button"
          className="btn btn--secondary btn--sm pos-quick-exp-btn"
          onClick={() => handleOpenQuickExpense('ADVANCE')}
          title="إضافة مصروف عاجل أو سحب عُهدة وطباعة البون"
        >
          <Plus size={13} /> مصروف سريع 💸
        </button>

        <button
          type="button"
          className="btn btn--secondary btn--sm"
          style={{ padding: '3px 8px', fontSize: '11px', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '4px' }}
          onClick={() => setShowReportModal(true)}
          title="عرض وطباعة تقرير اليومية الشامل"
        >
          <FileText size={13} /> تقرير اليومية 📊
        </button>

        <button type="button" className="shift-strip__close" onClick={onCloseShift}>
          <Lock size={13} /> قفل الشيفت
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

      {showReportModal && shift?.id && (
        <DailyReportModal
          isOpen={showReportModal}
          onClose={() => setShowReportModal(false)}
          shiftId={shift.id}
        />
      )}
    </>
  );
}
