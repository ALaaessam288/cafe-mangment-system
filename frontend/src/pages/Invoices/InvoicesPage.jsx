import { useState, useEffect, useCallback } from 'react';
import { ordersApi } from '../../api/ordersApi';
import { useToast } from '../../context/ToastContext';
import { formatCurrency, formatDateTime } from '../../utils/formatters';
import Spinner from '../../components/Spinner/Spinner';
import Badge from '../../components/Badge/Badge';
import PaymentModal from '../POS/PaymentModal';
import './InvoicesPage.css';

export default function InvoicesPage() {
  const toast = useToast();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [showPayment, setShowPayment] = useState(false);

  const loadOrders = useCallback(async () => {
    setLoading(true);
    try {
      const data = await ordersApi.findAll();
      // Sort newest first
      data.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      setOrders(data);
    } catch (err) {
      toast.error(err.message, 'فشل في تحميل الفواتير');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  const handleRowClick = async (orderId) => {
    try {
      const full = await ordersApi.findById(orderId);
      setSelectedOrder(full);
    } catch (err) {
      toast.error(err.message, 'فشل في تحميل تفاصيل الفاتورة');
    }
  };

  const handlePrint = () => {
    document.body.classList.add('printing-invoice');
    setTimeout(() => {
      window.print();
      document.body.classList.remove('printing-invoice');
    }, 50);
  };

  const handlePaymentSuccess = () => {
    setShowPayment(false);
    toast.success('تم الدفع وقفل الفاتورة وطباعتها بنجاح!');
    
    // Add print class, print, and clean up afterwards
    document.body.classList.add('printing-invoice');
    setTimeout(() => {
      window.print();
      document.body.classList.remove('printing-invoice');
      setSelectedOrder(null);
      loadOrders();
    }, 200);
  };

  const renderStatus = (status) => {
    const map = {
      OPEN: { label: 'مفتوح', variant: 'warning' },
      SENT: { label: 'تم الإرسال', variant: 'info' },
      SERVED: { label: 'نزلها طلب', variant: 'success' },
      CLOSED: { label: 'مقبوض', variant: 'success' },
      VOID: { label: 'ملغي', variant: 'danger' },
    };
    const mapped = map[status] || { label: status, variant: 'neutral' };
    return <Badge variant={mapped.variant} size="sm">{mapped.label}</Badge>;
  };

  if (loading && orders.length === 0) {
    return <div className="page" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}><Spinner /></div>;
  }

  return (
    <div className="page invoices-page">
      <header className="page__header">
        <div>
          <h1 className="page__title">الفواتير والأوردرات</h1>
          <p className="page__subtitle">إدارة ومراجعة جميع الفواتير ودفعها وطباعتها</p>
        </div>
      </header>

      <div className="invoices-layout">
        {/* Left: Table of all invoices */}
        <div className="invoices-list data-table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>رقم الأوردر</th>
                <th>النوع</th>
                <th>الحالة</th>
                <th>الإجمالي</th>
                <th>تاريخ الفتح</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <tr 
                  key={o.id} 
                  onClick={() => handleRowClick(o.id)}
                  className={selectedOrder?.id === o.id ? 'active-row' : ''}
                  style={{ cursor: 'pointer' }}
                >
                  <td>#{o.orderNumber}</td>
                  <td>{o.type === 'TAKEAWAY' ? 'تيك أواي' : `ترابيزة ${o.tableNumber}`}</td>
                  <td>{renderStatus(o.status)}</td>
                  <td>{formatCurrency(o.total)}</td>
                  <td className="text-muted text-sm">{formatDateTime(o.createdAt)}</td>
                </tr>
              ))}
              {orders.length === 0 && (
                <tr>
                  <td colSpan="5" className="text-center text-muted" style={{ padding: '2rem' }}>مفيش فواتير</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Right: Invoice details and Print layout */}
        <div className="invoice-details-panel">
          {selectedOrder ? (
            <div className="invoice-receipt-wrapper">
              <div className="invoice-receipt" id="print-receipt">
                <div className="receipt-header">
                  <h2>ونس كافيه</h2>
                  <p>رقم الأوردر: #{selectedOrder.orderNumber}</p>
                  <p>{selectedOrder.type === 'TAKEAWAY' ? 'تيك أواي' : `ترابيزة ${selectedOrder.tableNumber}`}</p>
                  <p>{formatDateTime(selectedOrder.createdAt)}</p>
                </div>
                
                <table className="receipt-items">
                  <thead>
                    <tr>
                      <th className="text-start">الصنف</th>
                      <th className="text-center">الكمية</th>
                      <th className="text-end">السعر</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(() => {
                      const grouped = [];
                      selectedOrder.items?.forEach(item => {
                        const existing = grouped.find(g => 
                          g.productNameSnapshot === item.productNameSnapshot &&
                          g.status === item.status &&
                          g.unitPriceSnapshot === item.unitPriceSnapshot
                        );
                        if (existing) {
                          existing.displayQty += item.quantity;
                          existing.displayTotal += item.lineTotal;
                        } else {
                          grouped.push({
                            ...item,
                            displayQty: item.quantity,
                            displayTotal: item.lineTotal
                          });
                        }
                      });

                      return grouped.map((item, idx) => (
                        <tr key={item.id + '-' + idx} className={item.status === 'CANCELLED' ? 'cancelled-item' : ''}>
                          <td className="text-start">
                            {item.productNameSnapshot}
                            {item.status === 'CANCELLED' && ' (ملغي)'}
                          </td>
                          <td className="text-center">{item.displayQty}</td>
                          <td className="text-end">{formatCurrency(item.displayTotal)}</td>
                        </tr>
                      ));
                    })()}
                  </tbody>
                </table>

                <div className="receipt-totals">
                  <div className="receipt-row">
                    <span>المجموع:</span>
                    <span>{formatCurrency(selectedOrder.subtotal)}</span>
                  </div>
                  {parseFloat(selectedOrder.discount) > 0 && (
                    <div className="receipt-row">
                      <span>خصم:</span>
                      <span>-{formatCurrency(selectedOrder.discount)}</span>
                    </div>
                  )}
                  {parseFloat(selectedOrder.service) > 0 && (
                    <div className="receipt-row">
                      <span>خدمة:</span>
                      <span>{formatCurrency(selectedOrder.service)}</span>
                    </div>
                  )}
                  <div className="receipt-row receipt-total">
                    <span>الإجمالي:</span>
                    <span>{formatCurrency(selectedOrder.total)}</span>
                  </div>
                </div>
                
                <div className="receipt-footer">
                  <p>شكراً لزيارتكم!</p>
                </div>
              </div>

              {/* Actions (Not printable) */}
              <div className="invoice-actions no-print">
                {(selectedOrder.status === 'OPEN' || selectedOrder.status === 'SENT' || selectedOrder.status === 'SERVED') ? (
                  <button className="btn btn--primary btn--md" onClick={() => setShowPayment(true)}>
                    دفع وقفل وطباعة الفاتورة
                  </button>
                ) : (
                  <button className="btn btn--secondary btn--md" onClick={handlePrint}>
                    طباعة الفاتورة
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="invoice-empty">
              اختار فاتورة من القائمة لعرض التفاصيل.
            </div>
          )}
        </div>
      </div>

      {showPayment && selectedOrder && (
        <PaymentModal
          order={selectedOrder}
          onClose={() => setShowPayment(false)}
          onSuccess={handlePaymentSuccess}
        />
      )}
    </div>
  );
}
