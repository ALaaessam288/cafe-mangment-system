import { useCallback, useEffect, useState, useMemo } from 'react';
import { Plus, Search, CheckCircle2, Trash2, Landmark, Printer, DollarSign, ArrowDownCircle } from 'lucide-react';
import { debtsApi } from '../../api/debtsApi';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';
import { formatCurrency, formatDateTime } from '../../utils/formatters';
import { printReceipt, buildDebtReceiptHtml } from '../../utils/printUtils';
import Button from '../../components/Button/Button';
import Badge from '../../components/Badge/Badge';
import Modal from '../../components/Modal/Modal';
import Input from '../../components/Input/Input';
import Spinner from '../../components/Spinner/Spinner';
import ObserverBanner from '../../components/ObserverBanner/ObserverBanner';
import { ROLES } from '../../utils/constants';
import './DebtsPage.css';

export default function DebtsPage() {
  const toast = useToast();
  const { user, role } = useAuth();
  const [debts, setDebts] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters & sorting
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('ALL'); // ALL | PENDING | PARTIAL | SETTLED
  const [sortBy, setSortBy] = useState('DATE_DESC');

  // Add debt modal
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [form, setForm] = useState({
    creditorName: '',
    amount: '',
    notes: '',
    debtDate: new Date().toISOString().split('T')[0],
    dueDate: ''
  });
  const [isSaving, setIsSaving] = useState(false);

  // Settle / Partial Payment modal
  const [settlingDebt, setSettlingDebt] = useState(null);
  const [payAmount, setPayAmount] = useState('');
  const [payNotes, setPayNotes] = useState('');
  const [paidFromDrawer, setPaidFromDrawer] = useState(true);
  const [isSettling, setIsSettling] = useState(false);

  const loadDebts = useCallback(async () => {
    setLoading(true);
    try {
      const data = await debtsApi.findAll();
      setDebts(data || []);
    } catch (err) {
      toast.error(err.message, 'فشل تحميل قائمة المديونيات');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { loadDebts(); }, [loadDebts]);

  function openAddModal() {
    setForm({
      creditorName: '',
      amount: '',
      notes: '',
      debtDate: new Date().toISOString().split('T')[0],
      dueDate: ''
    });
    setIsAddModalOpen(true);
  }

  async function handleSave(e) {
    e.preventDefault();
    if (!form.creditorName.trim() || !form.amount || parseFloat(form.amount) <= 0) {
      toast.error('الرجاء إدخال اسم الجهة الدائنة/العميل ومبلغ صحيح');
      return;
    }
    setIsSaving(true);
    try {
      await debtsApi.create({
        creditorName: form.creditorName.trim(),
        amount: parseFloat(form.amount),
        notes: form.notes,
        debtDate: form.debtDate,
        dueDate: form.dueDate || null,
      });
      toast.success('تم تسجيل المديونية بنجاح');
      setIsAddModalOpen(false);
      await loadDebts();
    } catch (err) {
      toast.error(err.message, 'فشل في تسجيل المديونية');
    } finally {
      setIsSaving(false);
    }
  }

  function openSettleModal(debt) {
    const rem = debt.remainingAmount != null ? debt.remainingAmount : (debt.amount - (debt.paidAmount || 0));
    setSettlingDebt(debt);
    setPayAmount(String(rem > 0 ? rem : debt.amount));
    setPayNotes('');
    setPaidFromDrawer(true);
  }

  async function handleSettleSubmit(e) {
    e.preventDefault();
    if (!settlingDebt) return;
    
    const parsedAmount = parseFloat(payAmount);
    if (!payAmount || isNaN(parsedAmount) || parsedAmount <= 0) {
      toast.error('الرجاء إدخال مبلغ سداد صحيح');
      return;
    }

    const currentRem = settlingDebt.remainingAmount != null ? settlingDebt.remainingAmount : settlingDebt.amount;
    if (parsedAmount > currentRem) {
      toast.warning(`المبلغ المدخل (${parsedAmount} ج.م) أكبر من المتبقي (${currentRem} ج.م). سيتم سداد المتبقي كاملاً.`);
    }

    setIsSettling(true);
    try {
      const updated = await debtsApi.settle(settlingDebt.id, {
        paidFromDrawer,
        amount: parsedAmount,
        notes: payNotes
      });
      
      const isFullySettled = updated.settled || parsedAmount >= currentRem;
      toast.success(
        isFullySettled
          ? `تم تسوية مديونية "${settlingDebt.creditorName}" بالكامل بنجاح`
          : `تم سداد مبلغ ${formatCurrency(parsedAmount)} من مديونية "${settlingDebt.creditorName}" (متبقي: ${formatCurrency(updated.remainingAmount || 0)})`
      );

      // Offer print receipt
      handlePrintDebt(updated || { ...settlingDebt, paidAmount: (settlingDebt.paidAmount || 0) + parsedAmount, remainingAmount: Math.max(0, currentRem - parsedAmount) }, parsedAmount);

      setSettlingDebt(null);
      await loadDebts();
    } catch (err) {
      toast.error(err.message, 'فشل في تسجيل سداد المديونية');
    } finally {
      setIsSettling(false);
    }
  }

  function handlePrintDebt(debt, recentPayment = null) {
    try {
      const html = buildDebtReceiptHtml({
        debt,
        paymentAmount: recentPayment,
        cafeName: user?.tenantName || 'الكافيه'
      });
      printReceipt(html, { width: 80 });
      toast.success(`جاري طباعة إيصال المديونية لـ "${debt.creditorName}"`);
    } catch (err) {
      toast.error(err.message, 'فشل إنشاء أمر الطباعة');
    }
  }

  function handlePrintAllDebts() {
    if (!filteredDebts || filteredDebts.length === 0) {
      toast.warning('لا توجد مديونيات للطباعة');
      return;
    }
    window.print();
  }

  async function handleDelete(debt) {
    if (!window.confirm(`هل أنت متأكد من حذف مديونية "${debt.creditorName}"؟`)) return;
    try {
      await debtsApi.delete(debt.id);
      toast.success('تم حذف المديونية بنجاح');
      await loadDebts();
    } catch (err) {
      toast.error(err.message, 'فشل في الحذف');
    }
  }

  // KPI totals
  const totals = useMemo(() => {
    let totalDebt = 0, totalPaid = 0, totalRemaining = 0, pendingCount = 0;
    debts.forEach((d) => {
      const amt = Number(d.amount || 0);
      const paid = Number(d.paidAmount || 0);
      const rem = d.remainingAmount != null ? Number(d.remainingAmount) : Math.max(0, amt - paid);
      
      totalDebt += amt;
      totalPaid += paid;
      totalRemaining += rem;

      if (!d.settled && rem > 0) {
        pendingCount++;
      }
    });
    return { totalDebt, totalPaid, totalRemaining, pendingCount };
  }, [debts]);

  // Filter + Sort
  const filteredDebts = useMemo(() => {
    const q = search.trim().toLowerCase();
    const result = debts.filter((d) => {
      const matchesSearch = !q ||
        d.creditorName.toLowerCase().includes(q) ||
        (d.notes && d.notes.toLowerCase().includes(q));

      const isSettled = !!d.settled;
      const isPartial = !isSettled && (d.paidAmount > 0);
      const isPending = !isSettled && (!d.paidAmount || d.paidAmount === 0);

      const matchesStatus =
        filterStatus === 'ALL' ? true :
        filterStatus === 'PENDING' ? isPending :
        filterStatus === 'PARTIAL' ? isPartial :
        filterStatus === 'UNSETTLED' ? !isSettled :
        isSettled;

      return matchesSearch && matchesStatus;
    });

    return [...result].sort((a, b) => {
      switch (sortBy) {
        case 'DATE_ASC':
          return new Date(a.debtDate) - new Date(b.debtDate);
        case 'AMOUNT_DESC':
          return (b.amount || 0) - (a.amount || 0);
        case 'AMOUNT_ASC':
          return (a.amount || 0) - (b.amount || 0);
        case 'REM_DESC':
          return (b.remainingAmount || b.amount || 0) - (a.remainingAmount || a.amount || 0);
        case 'DATE_DESC':
        default:
          return new Date(b.debtDate) - new Date(a.debtDate);
      }
    });
  }, [debts, search, filterStatus, sortBy]);

  return (
    <div className="page debts-page">
      <ObserverBanner />
      <div className="page__header">
        <div>
          <h1 className="page__title">المديونية وحسابات الآجل</h1>
          <p className="page__subtitle">متابعة وتسوية حسابات الموردين والجهات الخارجية والعملاء مع دعم السداد الجزئي</p>
        </div>
        <div className="page__actions" style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <Button variant="outline" leftIcon={<Printer size={16} />} onClick={handlePrintAllDebts}>
            طباعة كشف المديونيات
          </Button>
          {role === ROLES.SUPERVISOR && (
            <Button variant="primary" leftIcon={<Plus size={16} />} onClick={openAddModal}>
              إضافة مديونية جديدة
            </Button>
          )}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="debts-kpi-grid">
        <div className="kpi-box kpi-box--deduction">
          <span className="kpi-box__label">إجمالي أصل المديونيات</span>
          <strong className="kpi-box__val">{formatCurrency(totals.totalDebt)}</strong>
        </div>
        <div className="kpi-box kpi-box--net">
          <span className="kpi-box__label">إجمالي المبالغ المسددة</span>
          <strong className="kpi-box__val" style={{ color: '#22c55e' }}>{formatCurrency(totals.totalPaid)}</strong>
        </div>
        <div className="kpi-box kpi-box--advance">
          <span className="kpi-box__label">صافي المتبقي المستحق</span>
          <strong className="kpi-box__val" style={{ color: '#ef4444' }}>{formatCurrency(totals.totalRemaining)}</strong>
        </div>
        <div className="kpi-box kpi-box--base">
          <span className="kpi-box__label">عدد الحسابات المعلقة</span>
          <strong className="kpi-box__val">{totals.pendingCount}</strong>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="page-filters">
        <Input
          placeholder="بحث باسم العميل / الجهة الدائنة أو الملاحظات..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          leftIcon={<Search size={16} />}
          className="page-filters__search"
        />
        <div className="field-select">
          <select className="field-select__control" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
            <option value="ALL">كل الحالات</option>
            <option value="UNSETTLED">الديون المستحقة (غير مكتملة)</option>
            <option value="PENDING">معلقة بالكامل (لم يُسدد منها)</option>
            <option value="PARTIAL">سداد جزئي</option>
            <option value="SETTLED">مسددة بالكامل ✓</option>
          </select>
        </div>
        <div className="field-select">
          <select className="field-select__control" value={sortBy} onChange={(e) => setSortBy(e.target.value)} title="الترتيب">
            <option value="DATE_DESC">الأحدث أولاً</option>
            <option value="DATE_ASC">الأقدم أولاً</option>
            <option value="REM_DESC">الأعلى متبقياً</option>
            <option value="AMOUNT_DESC">الأعلى أصلاً</option>
            <option value="AMOUNT_ASC">الأقل أصلاً</option>
          </select>
        </div>
      </div>

      {/* Data Table */}
      <div className="data-table-wrap">
        {loading ? (
          <div className="data-table-empty"><Spinner /></div>
        ) : filteredDebts.length === 0 ? (
          <div className="data-table-empty">لا توجد مديونيات مطابقة لخيارات البحث والفلترة.</div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>الجهة / العميل</th>
                <th>أصل المبلغ</th>
                <th>المسدد</th>
                <th>المتبقي</th>
                <th>تاريخ المديونية</th>
                <th>تاريخ الاستحقاق</th>
                <th>ملاحظات</th>
                <th>الحالة</th>
                <th className="text-center">إجراءات</th>
              </tr>
            </thead>
            <tbody>
              {filteredDebts.map((debt) => {
                const rem = debt.remainingAmount != null ? debt.remainingAmount : Math.max(0, (debt.amount || 0) - (debt.paidAmount || 0));
                const isFull = !!debt.settled;
                const isPart = !isFull && (debt.paidAmount > 0);

                return (
                  <tr key={debt.id}>
                    <td style={{ fontWeight: 600 }}>{debt.creditorName}</td>
                    <td className="data-table__number">{formatCurrency(debt.amount)}</td>
                    <td className="data-table__number" style={{ color: '#22c55e' }}>
                      {debt.paidAmount > 0 ? formatCurrency(debt.paidAmount) : '0 ج.م'}
                    </td>
                    <td className="data-table__number" style={{ color: isFull ? 'var(--text-muted)' : '#ef4444', fontWeight: 700 }}>
                      {formatCurrency(rem)}
                    </td>
                    <td className="data-table__muted">{debt.debtDate}</td>
                    <td className="data-table__muted">{debt.dueDate || '—'}</td>
                    <td className="data-table__muted" style={{ maxWidth: '140px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={debt.notes}>
                      {debt.notes || '-'}
                    </td>
                    <td>
                      {isFull ? (
                        <Badge variant="success">مسددة بالكامل 🟢</Badge>
                      ) : isPart ? (
                        <Badge variant="info">سداد جزئي ⏳</Badge>
                      ) : (
                        <Badge variant="danger">معلقة 🔴</Badge>
                      )}
                    </td>
                    <td className="text-center">
                      <div className="data-table__actions" style={{ justifyContent: 'center', gap: '6px' }}>
                        {(!isFull && role === ROLES.SUPERVISOR) && (
                          <Button
                            variant="primary"
                            size="sm"
                            leftIcon={<DollarSign size={14} />}
                            onClick={() => openSettleModal(debt)}
                            style={{ background: 'var(--accent)', color: '#1c1917', fontWeight: 600 }}
                            title="سداد أي مبلغ جزئي أو كلي"
                          >
                            سداد مبلغ
                          </Button>
                        )}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handlePrintDebt(debt)}
                          title="طباعة إيصال المديونية"
                        >
                          <Printer size={14} />
                        </Button>
                        {role === ROLES.SUPERVISOR && (
                          <Button
                            variant="danger"
                            size="sm"
                            onClick={() => handleDelete(debt)}
                            title="حذف المديونية"
                          >
                            <Trash2 size={14} />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Add Debt Modal */}
      {(isAddModalOpen && role === ROLES.SUPERVISOR) && (
        <Modal
          isOpen={isAddModalOpen}
          onClose={() => !isSaving && setIsAddModalOpen(false)}
          title="إضافة مديونية جديدة"
          icon="📝"
          subtitle="تسجيل حساب آجل أو مديونية على عميل أو مورد وتحديد تاريخ الاستحقاق"
          size="md"
        >
          <form onSubmit={handleSave} className="form-grid">
            <Input
              label="الجهة الدائنة أو العميل"
              value={form.creditorName}
              onChange={(e) => setForm({ ...form, creditorName: e.target.value })}
              placeholder="مثال: مورد البن، شركة الصيانة، عميل آجل..."
              required
              autoFocus
            />
            <Input
              label="المبلغ الأصلي (ج.م)"
              type="number"
              min="0.01"
              step="0.01"
              value={form.amount}
              onChange={(e) => setForm({ ...form, amount: e.target.value })}
              required
            />
            <div className="form-grid--2">
              <Input
                label="تاريخ المديونية"
                type="date"
                value={form.debtDate}
                onChange={(e) => setForm({ ...form, debtDate: e.target.value })}
                required
              />
              <Input
                label="تاريخ الاستحقاق (اختياري)"
                type="date"
                value={form.dueDate}
                onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
              />
            </div>
            <Input
              label="ملاحظات (اختياري)"
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="تفاصيل إضافية عن الفاتورة أو المديونية"
            />
            <div className="form-actions">
              <Button type="button" variant="secondary" onClick={() => setIsAddModalOpen(false)} disabled={isSaving}>إلغاء</Button>
              <Button type="submit" variant="primary" loading={isSaving}>حفظ المديونية</Button>
            </div>
          </form>
        </Modal>
      )}

      {/* Settle / Partial Payment Modal */}
      {(settlingDebt && role === ROLES.SUPERVISOR) && (
        <Modal
          isOpen={!!settlingDebt}
          onClose={() => !isSettling && setSettlingDebt(null)}
          title={`سداد مديونية`}
          icon="💵"
          subtitle={`سداد دفعة نقدية أو كامل حساب: ${settlingDebt.creditorName}`}
          size="sm"
        >
          <form onSubmit={handleSettleSubmit} className="form-stack">
            <div style={{
              background: 'var(--bg-lighter)',
              borderRadius: 'var(--radius-md)',
              padding: '12px',
              display: 'flex',
              flexDirection: 'column',
              gap: '6px',
              fontSize: '13px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>أصل المديونية:</span>
                <strong>{formatCurrency(settlingDebt.amount)}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#22c55e' }}>
                <span>المسدد سابقاً:</span>
                <strong>{formatCurrency(settlingDebt.paidAmount || 0)}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#ef4444', fontWeight: 'bold', borderTop: '1px dashed var(--border-default)', paddingTop: '6px' }}>
                <span>المتبقي المطلوب:</span>
                <strong>{formatCurrency(settlingDebt.remainingAmount != null ? settlingDebt.remainingAmount : settlingDebt.amount)}</strong>
              </div>
            </div>

            <div style={{ marginTop: '1rem' }}>
              <Input
                label="المبلغ المراد سداده الآن (ج.م)"
                type="number"
                min="0.01"
                step="0.01"
                value={payAmount}
                onChange={(e) => setPayAmount(e.target.value)}
                placeholder="أدخل أي مبلغ جزئي أو المبلغ كاملاً"
                required
                autoFocus
              />
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '6px' }}>
                <button
                  type="button"
                  className="preset-chip-btn"
                  onClick={() => setPayAmount(String(settlingDebt.remainingAmount != null ? settlingDebt.remainingAmount : settlingDebt.amount))}
                >
                  سداد الباقي كاملاً ({formatCurrency(settlingDebt.remainingAmount != null ? settlingDebt.remainingAmount : settlingDebt.amount)})
                </button>
                {['50', '100', '200', '500'].map((amt) => (
                  <button
                    key={amt}
                    type="button"
                    className="preset-chip-btn"
                    onClick={() => setPayAmount(amt)}
                  >
                    {amt} ج.م
                  </button>
                ))}
              </div>
            </div>

            <div style={{ marginTop: '0.75rem' }}>
              <Input
                label="ملاحظات السداد (اختياري)"
                value={payNotes}
                onChange={(e) => setPayNotes(e.target.value)}
                placeholder="مثال: دفعة كاش تحت الحساب / استلام شيك"
              />
            </div>

            <label className="checkbox-label" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', marginTop: '1rem' }}>
              <input
                type="checkbox"
                checked={paidFromDrawer}
                onChange={(e) => setPaidFromDrawer(e.target.checked)}
              />
              خصم وتسديد المبلغ فوراً من الخزينة/درج الكاشير الحالي (تسجيل مصروف)
            </label>

            <div className="form-actions" style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginTop: '1.5rem' }}>
              <Button type="button" variant="secondary" onClick={() => setSettlingDebt(null)} disabled={isSettling}>تراجع</Button>
              <Button type="submit" variant="primary" loading={isSettling}>تأكيد وحفظ السداد 💵</Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}