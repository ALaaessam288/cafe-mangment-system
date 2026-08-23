import { useCallback, useEffect, useState } from 'react';
import { Package, Search, Settings } from 'lucide-react';
import { menuApi } from '../../api/menuApi';
import { useToast } from '../../context/ToastContext';
import Button from '../../components/Button/Button';
import Badge from '../../components/Badge/Badge';
import Spinner from '../../components/Spinner/Spinner';
import Modal from '../../components/Modal/Modal';
import Input from '../../components/Input/Input';
import client from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { ROLES } from '../../utils/constants';
import ObserverBanner from '../../components/ObserverBanner/ObserverBanner';

export default function InventoryPage() {
  const toast = useToast();
  const { role } = useAuth();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  // Stock Adjustment Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [actualQuantity, setActualQuantity] = useState('');
  const [adjustmentReason, setAdjustmentReason] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const loadProducts = useCallback(async () => {
    setLoading(true);
    try {
      const data = await menuApi.getProducts();
      // Only show products that track inventory
      setProducts(data.filter(p => p.trackInventory || p.available));
    } catch (err) {
      toast.error(err.message, 'فشل تحميل بيانات الجرد');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { loadProducts(); }, [loadProducts]);

  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  function handleOpenModal(product) {
    setSelectedProduct(product);
    setActualQuantity(product.stockQuantity || 0);
    setAdjustmentReason('');
    setIsModalOpen(true);
  }

  async function handleSaveAdjustment(e) {
    e.preventDefault();
    if (!selectedProduct || actualQuantity === '') return;

    const currentQty = selectedProduct.stockQuantity || 0;
    const actualQty = parseInt(actualQuantity, 10);
    const diff = actualQty - currentQty;

    if (diff === 0) {
      toast.error('لم يتم تغيير الكمية');
      return;
    }

    setIsSaving(true);
    try {
      // POST /api/products/{id}/stock-adjustments
      const payload = {
        type: diff > 0 ? 'CORRECTION' : 'WASTE',
        quantityChange: diff,
        reason: adjustmentReason || 'جرد وتعديل يدوي'
      };

      await client.post(`/products/${selectedProduct.id}/stock-adjustments`, payload);

      toast.success('تم تحديث الجرد بنجاح');
      setIsModalOpen(false);
      loadProducts();
    } catch (err) {
      toast.error(err.message, 'خطأ في حفظ الجرد');
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="page">
      <ObserverBanner />
      <div className="page__header">
        <div>
          <h1 className="page__title">الجرد والمخزون</h1>
          <p className="page__subtitle">إدارة جرد المنتجات وتسوية الأرصدة</p>
        </div>
      </div>

      <div className="filters-bar" style={{ display: 'flex', gap: '12px', marginBottom: '16px', background: 'var(--bg-secondary)', padding: '12px', borderRadius: '8px' }}>
        <div className="search-box" style={{ flex: 1, position: 'relative' }}>
          <Search size={18} style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input 
            type="text" 
            placeholder="ابحث عن منتج..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ width: '100%', padding: '10px 36px 10px 12px', borderRadius: '6px', border: '1px solid var(--border-subtle)', background: 'var(--bg-primary)', color: 'var(--text-primary)' }}
          />
        </div>
      </div>

      <div className="data-table-wrap">
        {loading ? (
          <div className="data-table-empty"><Spinner /></div>
        ) : filteredProducts.length === 0 ? (
          <div className="data-table-empty">لا توجد منتجات خاضعة للجرد. قم بتفعيل "تتبع المخزون" للمنتجات من صفحة المنتجات.</div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>اسم المنتج</th>
                <th>التصنيف</th>
                <th>الكمية المسجلة (النظام)</th>
                <th>الحالة</th>
                <th style={{ textAlign: 'left' }}>التحكم</th>
              </tr>
            </thead>
            <tbody>
              {filteredProducts.map((prod) => (
                <tr key={prod.id}>
                  <td style={{ fontWeight: 500 }}>{prod.name}</td>
                  <td>{prod.categoryName}</td>
                  <td className="data-table__number" style={{ fontSize: '1.1rem', fontWeight: 'bold' }}>
                    {prod.stockQuantity}
                  </td>
                  <td>
                    {prod.stockQuantity <= 0 ? (
                      <Badge variant="danger">نفذت الكمية</Badge>
                    ) : prod.stockQuantity <= 10 ? (
                      <Badge variant="warning">كمية منخفضة</Badge>
                    ) : (
                      <Badge variant="success">متوفر</Badge>
                    )}
                  </td>
                  <td>
                    <div className="data-table__actions" style={{ justifyContent: 'flex-end' }}>
                      {role === ROLES.SUPERVISOR && (
                        <Button variant="secondary" size="sm" onClick={() => handleOpenModal(prod)}>
                          تسوية جرد
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {selectedProduct && (
        <Modal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          title={`تسوية جرد: ${selectedProduct.name}`}
          size="sm"
        >
          <form onSubmit={handleSaveAdjustment} className="form-grid">
            <div style={{ gridColumn: '1 / -1', background: 'var(--bg-tertiary)', padding: '12px', borderRadius: '8px', marginBottom: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ color: 'var(--text-muted)' }}>الكمية المسجلة حالياً بالبرنامج:</span>
                <strong style={{ fontSize: '16px' }}>{selectedProduct.stockQuantity}</strong>
              </div>
            </div>

            <Input
              label="الكمية الفعلية (التي تم جردها يدوياً)"
              type="number"
              value={actualQuantity}
              onChange={(e) => setActualQuantity(e.target.value)}
              required
              min="0"
            />

            <Input
              label="سبب التسوية (اختياري)"
              type="text"
              value={adjustmentReason}
              onChange={(e) => setAdjustmentReason(e.target.value)}
              placeholder="مثال: جرد نهاية اليوم، هالك، الخ..."
            />

            <div className="form-actions" style={{ gridColumn: '1 / -1', marginTop: '16px', display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <Button type="button" variant="secondary" onClick={() => setIsModalOpen(false)}>إلغاء</Button>
              <Button type="submit" loading={isSaving}>حفظ تسوية الجرد</Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
