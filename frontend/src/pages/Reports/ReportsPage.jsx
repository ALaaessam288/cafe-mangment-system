import { useCallback, useEffect, useState } from 'react';
import { Calendar, DollarSign, Clock, RefreshCw } from 'lucide-react';
import { shiftsApi } from '../../api/shiftsApi';
import { reportsApi } from '../../api/reportsApi';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';
import { formatCurrency, formatDateTime } from '../../utils/formatters';
import Button from '../../components/Button/Button';
import Badge from '../../components/Badge/Badge';
import Spinner from '../../components/Spinner/Spinner';
import Modal from '../../components/Modal/Modal';
import { ROLES } from '../../utils/constants';
import './ReportsPage.css';

export default function ReportsPage() {
  const toast = useToast();
  const { role } = useAuth();
  const isAdmin = role === ROLES.ADMIN;
  const [shifts, setShifts] = useState([]);
  const [financialData, setFinancialData] = useState(null);
  const [loading, setLoading] = useState(true);

  // Selected shift details
  const [selectedShift, setSelectedShift] = useState(null);
  const [shiftReport, setShiftReport] = useState(null);
  const [loadingShiftDetails, setLoadingShiftDetails] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const shiftsData = await shiftsApi.findAll();
      setShifts(shiftsData.sort((a, b) => new Date(b.openedAt) - new Date(a.openedAt)));
      
      if (isAdmin) {
        const finData = await reportsApi.getFinancialReport();
        setFinancialData(finData);
      }
    } catch (err) {
      toast.error(err.message, 'فشل تحميل التقارير');
    } finally {
      setLoading(false);
    }
  }, [toast, isAdmin]);

  useEffect(() => { loadData(); }, [loadData]);

  async function handleViewShiftDetails(shift) {
    setSelectedShift(shift);
    setIsModalOpen(true);
    setLoadingShiftDetails(true);

    try {
      const report = await shiftsApi.getReport(shift.id);
      setShiftReport(report);
    } catch (err) {
      toast.error(err.message, 'Failed to load shift details');
    } finally {
      setLoadingShiftDetails(false);
    }
  }

  // Calculate some simple global stats from shifts (e.g. today's active shift)
  const activeShift = shifts.find(s => s.closedAt === null);

  return (
    <div className="page">
      <div className="page__header">
        <div>
          <h1 className="page__title">التقارير والشيفتات</h1>
          <p className="page__subtitle">عرض الشيفتات القديمة وتقارير الإيرادات</p>
        </div>
        <div className="page__actions">
          <Button variant="ghost" rightIcon={<RefreshCw size={16} />} onClick={loadData} loading={loading}>
            تحديث
          </Button>
        </div>
      </div>

      {isAdmin && financialData && (
        <div className="section-card" style={{ marginBottom: '2rem' }}>
          <h2 className="section-card__title">الملخص المالي الشامل (للمدير فقط)</h2>
          <div className="reports-grid" style={{ marginBottom: '1.5rem', gridTemplateColumns: 'repeat(4, 1fr)' }}>
            <div className="report-card" style={{ padding: '1rem' }}>
              <div className="report-card__label" style={{ fontSize: '0.8rem' }}>إيرادات المشروبات (الكافيه)</div>
              <div className="report-card__value" style={{ color: 'var(--success)' }}>{formatCurrency(financialData.totalCafeRevenue)}</div>
            </div>
            <div className="report-card" style={{ padding: '1rem' }}>
              <div className="report-card__label" style={{ fontSize: '0.8rem' }}>إيرادات المأكولات (المطعم)</div>
              <div className="report-card__value" style={{ color: 'var(--success)' }}>{formatCurrency(financialData.totalRestaurantRevenue)}</div>
            </div>
            <div className="report-card" style={{ padding: '1rem' }}>
              <div className="report-card__label" style={{ fontSize: '0.8rem' }}>إجمالي الرواتب والأجور</div>
              <div className="report-card__value" style={{ color: 'var(--danger)' }}>-{formatCurrency(financialData.totalWages)}</div>
            </div>
            <div className="report-card" style={{ padding: '1rem', background: 'rgba(59, 130, 246, 0.1)' }}>
              <div className="report-card__label" style={{ fontSize: '0.8rem' }}>صافي الربح</div>
              <div className="report-card__value" style={{ color: financialData.netProfit >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                {formatCurrency(financialData.netProfit)}
              </div>
            </div>
          </div>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
             <div className="report-card" style={{ padding: '1rem' }}>
              <div className="report-card__label" style={{ fontSize: '0.8rem' }}>مصاريف الكافيه</div>
              <div className="report-card__value" style={{ color: 'var(--danger)' }}>-{formatCurrency(financialData.totalCafeExpenses)}</div>
            </div>
             <div className="report-card" style={{ padding: '1rem' }}>
              <div className="report-card__label" style={{ fontSize: '0.8rem' }}>مصاريف المطعم</div>
              <div className="report-card__value" style={{ color: 'var(--danger)' }}>-{formatCurrency(financialData.totalRestaurantExpenses)}</div>
            </div>
          </div>
        </div>
      )}

      <div className="reports-grid">
        {/* Simple Summary Cards */}
        <div className="report-card">
          <div className="report-card__icon" style={{ backgroundColor: 'var(--info-dim)', color: 'var(--info)' }}>
            <Calendar size={24} />
          </div>
          <div className="report-card__content">
            <div className="report-card__label">إجمالي الشيفتات</div>
            <div className="report-card__value">{shifts.length}</div>
          </div>
        </div>
        
        <div className="report-card">
          <div className="report-card__icon" style={{ backgroundColor: 'var(--success-dim)', color: 'var(--success)' }}>
            <Clock size={24} />
          </div>
          <div className="report-card__content">
            <div className="report-card__label">الشيفت الحالي</div>
            <div className="report-card__value">
              {activeShift ? `بدأ الساعة ${formatDateTime(activeShift.openedAt)}` : 'مفيش'}
            </div>
          </div>
        </div>
      </div>

      <div className="section-card">
        <h2 className="section-card__title">تاريخ الشيفتات</h2>
        
        <div className="data-table-wrap">
          {loading ? (
            <div className="data-table-empty"><Spinner /></div>
          ) : shifts.length === 0 ? (
            <div className="data-table-empty">مفيش شيفتات اتسجلت.</div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>رقم الشيفت</th>
                  <th>وقت الفتح</th>
                  <th>وقت القفل</th>
                  <th>اتفتح بواسطة</th>
                  <th>الحالة</th>
                  <th style={{ textAlign: 'left' }}>تحكم</th>
                </tr>
              </thead>
              <tbody>
                {shifts.map((shift) => (
                  <tr key={shift.id}>
                    <td className="data-table__mono">#{String(shift.id).slice(-6)}</td>
                    <td>{formatDateTime(shift.openedAt)}</td>
                    <td>{shift.closedAt ? formatDateTime(shift.closedAt) : '—'}</td>
                    <td>{shift.username || '—'}</td>
                    <td>
                      <Badge variant={!shift.closedAt ? 'success' : 'neutral'}>
                        {!shift.closedAt ? 'مفتوح' : 'مقفول'}
                      </Badge>
                    </td>
                    <td>
                      <div className="data-table__actions" style={{ justifyContent: 'flex-end' }}>
                        <Button variant="secondary" size="sm" onClick={() => handleViewShiftDetails(shift)}>
                          عرض الملخص
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Shift Details Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={`ملخص الشيفت`}
        size="md"
      >
        {loadingShiftDetails ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem' }}><Spinner /></div>
        ) : (
          <div className="shift-summary">
            <div className="shift-summary__header">
              <div className="shift-summary__row">
                <span>الحالة:</span>
                <Badge variant={!selectedShift?.closedAt ? 'success' : 'neutral'}>
                  {!selectedShift?.closedAt ? 'مفتوح' : 'مقفول'}
                </Badge>
              </div>
              <div className="shift-summary__row">
                <span>الفتح:</span>
                <span>{formatDateTime(selectedShift?.openedAt)}</span>
              </div>
              {selectedShift?.closedAt && (
                <div className="shift-summary__row">
                  <span>القفل:</span>
                  <span>{formatDateTime(selectedShift?.closedAt)}</span>
                </div>
              )}
            </div>

            <h4 style={{ margin: '1rem 0 0.5rem', color: 'var(--text-primary)' }}>مبيعات الشيفت</h4>
            <div className="shift-summary__stats">
              <div className="shift-summary__stat">
                <span>إجمالي الإيرادات</span>
                <strong style={{ color: 'var(--accent)' }}>
                  {formatCurrency(shiftReport?.totalCollected || 0)}
                </strong>
              </div>
            </div>

            <h4 style={{ margin: '1.5rem 0 0.5rem', color: 'var(--text-primary)', fontSize: '14px' }}>تفاصيل الدفع</h4>
            <div className="shift-summary__stats" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
              <div className="shift-summary__stat" style={{ background: 'rgba(16, 185, 129, 0.1)', borderColor: 'rgba(16, 185, 129, 0.2)' }}>
                <span>كاش</span>
                <strong style={{ color: 'var(--success)' }}>{formatCurrency(shiftReport?.cashCollected || 0)}</strong>
              </div>
              <div className="shift-summary__stat" style={{ background: 'rgba(139, 92, 246, 0.1)', borderColor: 'rgba(139, 92, 246, 0.2)' }}>
                <span>انستاباي</span>
                <strong style={{ color: '#a78bfa' }}>{formatCurrency(shiftReport?.instapayCollected || 0)}</strong>
              </div>
              <div className="shift-summary__stat" style={{ background: 'rgba(59, 130, 246, 0.1)', borderColor: 'rgba(59, 130, 246, 0.2)' }}>
                <span>محفظة</span>
                <strong style={{ color: '#60a5fa' }}>{formatCurrency(shiftReport?.walletCollected || 0)}</strong>
              </div>
            </div>

            {selectedShift?.closedAt && (
              <>
                <h4 style={{ margin: '1.5rem 0 0.5rem', color: 'var(--text-primary)', fontSize: '14px' }}>حالة الدرج عند القفل</h4>
                <div className="shift-summary__stats">
                  <div className="shift-summary__stat">
                    <span>المتوقع (العهدة + الكاش)</span>
                    <strong>{formatCurrency(shiftReport?.expectedCash || selectedShift.expectedCash)}</strong>
                  </div>
                  <div className="shift-summary__stat">
                    <span>الفعلي (اللي تم جرده)</span>
                    <strong>{formatCurrency(shiftReport?.countedCash || selectedShift.countedCash)}</strong>
                  </div>
                  <div className="shift-summary__stat">
                    <span>العجز / الزيادة</span>
                    <strong style={{ color: (shiftReport?.variance || selectedShift.variance) < 0 ? 'var(--danger)' : (shiftReport?.variance || selectedShift.variance) > 0 ? 'var(--success)' : 'inherit' }}>
                      {formatCurrency(shiftReport?.variance || selectedShift.variance)}
                    </strong>
                  </div>
                </div>
              </>
            )}

            <div className="form-actions" style={{ display: 'flex', justifyContent: 'space-between', marginTop: '1.5rem', alignItems: 'center' }}>
              {!selectedShift?.closedAt ? (
                <Button 
                  variant="primary" 
                  style={{ background: 'var(--danger)', color: 'white' }}
                  onClick={async () => {
                    const cash = prompt('أدخل الكاش الفعلي في الدرج لإنهاء هذا الشيفت إجبارياً:');
                    if (cash === null) return;
                    if (isNaN(cash) || cash === '') {
                      toast.error('مبلغ غير صالح');
                      return;
                    }
                    try {
                      await shiftsApi.forceClose(selectedShift.id, { countedCash: parseFloat(cash) });
                      toast.success('تم إنهاء الشيفت بنجاح');
                      setIsModalOpen(false);
                      loadData();
                    } catch (err) {
                      toast.error(err.message, 'فشل في إنهاء الشيفت');
                    }
                  }}
                >
                  إنهاء إجباري
                </Button>
              ) : (
                <div />
              )}
              <Button variant="secondary" onClick={() => setIsModalOpen(false)}>إغلاق النافذة</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
