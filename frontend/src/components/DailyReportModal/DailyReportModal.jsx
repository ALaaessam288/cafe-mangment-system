import React, { useState, useEffect } from 'react';
import { Printer, TrendingUp, Utensils, Coffee, DollarSign, Wallet, Users, AlertCircle, ShoppingBag, ArrowDownLeft, ArrowUpRight, Receipt } from 'lucide-react';
import Modal from '../Modal/Modal';
import Spinner from '../Spinner/Spinner';
import { shiftsApi } from '../../api/shiftsApi';
import { formatCurrency, formatDateTime } from '../../utils/formatters';
import { printReceipt, buildShiftSummaryHtml } from '../../utils/printUtils';
import { printOptionsFor } from '../../utils/printerSettings';

export default function DailyReportModal({ isOpen, onClose, shiftId, cafeName }) {
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [printing, setPrinting] = useState(false);

  useEffect(() => {
    if (!isOpen || !shiftId) return;
    setLoading(true);
    shiftsApi.getReport(shiftId)
      .then((data) => setReport(data))
      .catch((err) => console.error('Failed to load shift report', err))
      .finally(() => setLoading(false));
  }, [isOpen, shiftId]);

  const handlePrint = () => {
    if (!report) return;
    setPrinting(true);
    const html = buildShiftSummaryHtml({ report, cafeName });
    printReceipt(html, printOptionsFor('REPORT', { width: 80 }));
    setTimeout(() => setPrinting(false), 500);
  };

  const shift = report?.shift || {};
  const totalRevenue = Number(report?.totalRevenue ?? 0);
  const totalCash = Number(report?.totalCash ?? 0);
  const totalInstapay = Number(report?.totalInstapay ?? 0);
  const totalWallet = Number(report?.totalWallet ?? 0);
  const foodRevenue = Number(report?.foodRevenue ?? 0);
  const buffetRevenue = Number(report?.buffetRevenue ?? 0);
  const snacksNet = Number(report?.snacksNet ?? 0);
  const totalDiscounts = Number(report?.totalDiscounts ?? 0);
  const totalService = Number(report?.totalService ?? 0);
  const totalExpenses = Number(report?.totalExpenses ?? 0);
  const totalNewDebts = Number(report?.totalNewDebts ?? 0);
  const totalCollectedDebts = Number(report?.totalCollectedDebts ?? 0);
  const totalEmployeeAdvances = Number(report?.totalEmployeeAdvances ?? 0);
  const totalEmployeeDeductions = Number(report?.totalEmployeeDeductions ?? 0);
  const totalEmployeeBonuses = Number(report?.totalEmployeeBonuses ?? 0);
  const expectedCashInDrawer = Number(report?.expectedCashInDrawer ?? 0);
  const productSales = report?.productSales || [];
  const expenses = report?.expenses || [];
  const employeeMovements = report?.employeeMovements || [];
  const totalItemsSold = Number(report?.totalItemsSold ?? 0);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`📊 تقرير اليومية والشيفت #${shiftId || ''}`} size="lg">
      {loading ? (
        <div style={{ padding: '40px', textAlign: 'center' }}><Spinner /></div>
      ) : !report ? (
        <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)' }}>تعذر تحميل بيانات التقرير</div>
      ) : (
        <div className="daily-report-modal" style={{ maxHeight: '78vh', overflowY: 'auto', paddingInlineEnd: '4px' }}>
          {/* Header Action Bar */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', background: 'var(--bg-secondary)', padding: '12px 16px', borderRadius: '10px' }}>
            <div>
              <div style={{ fontWeight: '800', fontSize: '15px' }}>الكاشير: {shift.userName || 'الكاشير'} | خزينة: {shift.registerName || 'الرئيسية'}</div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                بدأ: {shift.openedAt ? formatDateTime(shift.openedAt) : '-'} {shift.closedAt ? ` | انتهى: ${formatDateTime(shift.closedAt)}` : ' | 🟢 مفتوح الآن'}
              </div>
            </div>
            <button
              type="button"
              className="btn btn--primary btn--md"
              onClick={handlePrint}
              disabled={printing}
              style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: '800' }}
            >
              <Printer size={16} /> 🖨️ طباعة التقرير (80mm)
            </button>
          </div>

          {/* Stat Cards Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '10px', marginBottom: '16px' }}>
            <div style={{ background: 'linear-gradient(135deg, #1e293b, #0f172a)', color: '#fff', padding: '12px', borderRadius: '10px', border: '1px solid #334155' }}>
              <div style={{ fontSize: '12px', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '4px' }}><TrendingUp size={14} /> إجمالي المبيعات</div>
              <div style={{ fontSize: '18px', fontWeight: '900', marginTop: '4px' }}>{formatCurrency(totalRevenue)}</div>
            </div>

            <div style={{ background: 'var(--bg-surface)', padding: '12px', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}><Utensils size={14} /> 🍕 المطبخ / الأكل</div>
              <div style={{ fontSize: '17px', fontWeight: '800', marginTop: '4px', color: '#f97316' }}>{formatCurrency(foodRevenue)}</div>
            </div>

            <div style={{ background: 'var(--bg-surface)', padding: '12px', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}><Coffee size={14} /> ☕ البوفيه والمشروبات</div>
              <div style={{ fontSize: '17px', fontWeight: '800', marginTop: '4px', color: '#0ea5e9' }}>{formatCurrency(buffetRevenue)}</div>
            </div>

            <div style={{ background: 'var(--bg-surface)', padding: '12px', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>🍿 السناكس والحلويات</div>
              <div style={{ fontSize: '17px', fontWeight: '800', marginTop: '4px', color: '#eab308' }}>{formatCurrency(snacksNet)}</div>
            </div>

            <div style={{ background: 'var(--bg-surface)', padding: '12px', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>💸 إجمالي المصاريف</div>
              <div style={{ fontSize: '17px', fontWeight: '800', marginTop: '4px', color: '#ef4444' }}>-{formatCurrency(totalExpenses)}</div>
            </div>

            <div style={{ background: 'var(--bg-surface)', padding: '12px', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>👥 سُلف الموظفين</div>
              <div style={{ fontSize: '17px', fontWeight: '800', marginTop: '4px', color: '#ec4899' }}>-{formatCurrency(totalEmployeeAdvances)}</div>
            </div>
          </div>

          {/* Cash Drawer Reconciliation Card */}
          <div style={{ background: 'var(--bg-secondary)', border: '1.5px solid var(--border-color)', borderRadius: '10px', padding: '14px', marginBottom: '16px' }}>
            <div style={{ fontWeight: '800', fontSize: '14px', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Wallet size={16} /> 💵 حركة النقدية وصافي الدرج (Cash Drawer)
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '8px', fontSize: '13px' }}>
              <div>رصيد الافتتاح: <strong>{formatCurrency(shift.openingFloat || 0)}</strong></div>
              <div>المبيعات النقدية (Cash): <strong style={{ color: '#16a34a' }}>+{formatCurrency(totalCash)}</strong></div>
              {totalCollectedDebts > 0 && <div>تحصيل مديونيات: <strong style={{ color: '#16a34a' }}>+{formatCurrency(totalCollectedDebts)}</strong></div>}
              {totalExpenses > 0 && <div>المصاريف من الدرج: <strong style={{ color: '#ef4444' }}>-{formatCurrency(totalExpenses)}</strong></div>}
              {totalEmployeeAdvances > 0 && <div>سُلف الموظفين: <strong style={{ color: '#ef4444' }}>-{formatCurrency(totalEmployeeAdvances)}</strong></div>}
            </div>
            <div style={{ marginTop: '10px', paddingTop: '8px', borderTop: '1px dashed var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontWeight: '800', fontSize: '14px' }}>النقدية المفترضة في الدرج:</span>
              <span style={{ fontSize: '18px', fontWeight: '900', color: 'var(--color-primary)' }}>{formatCurrency(expectedCashInDrawer)}</span>
            </div>
          </div>

          {/* Product Sales Breakdown Table */}
          <div style={{ marginBottom: '16px' }}>
            <div style={{ fontWeight: '800', fontSize: '14px', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <ShoppingBag size={16} /> 📊 تفصيل مبيعات الأصناف ({productSales.length} صنف - {totalItemsSold} قطعة)
            </div>
            <div className="data-table-wrap" style={{ maxHeight: '240px', overflowY: 'auto' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>اسم الصنف</th>
                    <th>القسم</th>
                    <th>الكمية المباعة</th>
                    <th>إجمالي المبلغ</th>
                  </tr>
                </thead>
                <tbody>
                  {productSales.map((p, idx) => (
                    <tr key={idx}>
                      <td>{idx + 1}</td>
                      <td style={{ fontWeight: '700' }}>{p.productName}</td>
                      <td><span style={{ fontSize: '11px', background: 'var(--bg-secondary)', padding: '2px 6px', borderRadius: '4px' }}>{p.categoryName}</span></td>
                      <td style={{ fontWeight: '800', color: 'var(--color-primary)' }}>{p.quantitySold}</td>
                      <td style={{ fontWeight: '800' }}>{formatCurrency(p.totalAmount)}</td>
                    </tr>
                  ))}
                  {productSales.length === 0 && (
                    <tr><td colSpan="5" style={{ textAlign: 'center', padding: '12px' }}>لا توجد مبيعات في هذا الشيفت</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Expenses & Employee Movements Tables */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px', marginBottom: '16px' }}>
            {/* Expenses */}
            <div>
              <div style={{ fontWeight: '800', fontSize: '13px', marginBottom: '6px' }}>💸 المصاريف المسجلة ({expenses.length})</div>
              <div className="data-table-wrap" style={{ maxHeight: '180px', overflowY: 'auto' }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>البيان</th>
                      <th>المبلغ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {expenses.map((e) => (
                      <tr key={e.id}>
                        <td>{e.description}</td>
                        <td style={{ fontWeight: '800', color: '#ef4444' }}>{formatCurrency(e.amount)}</td>
                      </tr>
                    ))}
                    {expenses.length === 0 && (
                      <tr><td colSpan="2" style={{ textAlign: 'center', padding: '8px', color: 'var(--text-muted)' }}>لا توجد مصاريف</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Employee Movements */}
            <div>
              <div style={{ fontWeight: '800', fontSize: '13px', marginBottom: '6px' }}>👥 حركة الموظفين ({employeeMovements.length})</div>
              <div className="data-table-wrap" style={{ maxHeight: '180px', overflowY: 'auto' }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>الموظف</th>
                      <th>النوع</th>
                      <th>المبلغ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {employeeMovements.map((m) => (
                      <tr key={m.id}>
                        <td style={{ fontWeight: '700' }}>{m.employeeName}</td>
                        <td>
                          <span style={{ fontSize: '11px', padding: '1px 6px', borderRadius: '4px', background: m.type === 'ADVANCE' ? '#fce7f3' : m.type === 'DEDUCTION' ? '#fee2e2' : '#dcfce7', color: m.type === 'ADVANCE' ? '#be185d' : m.type === 'DEDUCTION' ? '#b91c1c' : '#15803d' }}>
                            {m.type === 'ADVANCE' ? 'سلفة' : m.type === 'DEDUCTION' ? 'خصم' : 'مكافأة'}
                          </span>
                        </td>
                        <td style={{ fontWeight: '800' }}>{formatCurrency(m.amount)}</td>
                      </tr>
                    ))}
                    {employeeMovements.length === 0 && (
                      <tr><td colSpan="3" style={{ textAlign: 'center', padding: '8px', color: 'var(--text-muted)' }}>لا توجد حركات موظفين</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Footer Print & Close */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', borderTop: '1px solid var(--border-color)', paddingTop: '12px' }}>
            <button type="button" className="btn btn--secondary" onClick={onClose}>
              إغلاق
            </button>
            <button type="button" className="btn btn--primary" onClick={handlePrint} disabled={printing}>
              <Printer size={16} /> 🖨️ طباعة بون اليومية (80mm)
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}
