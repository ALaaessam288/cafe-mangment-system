import { useCallback, useEffect, useState } from 'react';
import { Package, Search, Plus, Trash2, Edit, Coffee, CheckCircle, AlertTriangle } from 'lucide-react';
import { menuApi } from '../../api/menuApi';
import { auditApi } from '../../api/auditApi';
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
import './InventoryPage.css';

export default function InventoryPage() {
  const toast = useToast();
  const { role } = useAuth();
  const isSupervisor = role === ROLES.SUPERVISOR;

  const [activeTab, setActiveTab] = useState('audit-items'); // 'audit-items' | 'products'
  
  // Products state
  const [products, setProducts] = useState([]);
  const [productsLoading, setProductsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  // Stock Adjustment Modal for products
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [actualQuantity, setActualQuantity] = useState('');
  const [adjustmentReason, setAdjustmentReason] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Shift Raw Material Audit Items state
  const [auditItems, setAuditItems] = useState([]);
  const [auditItemsLoading, setAuditItemsLoading] = useState(true);
  const [isAuditModalOpen, setIsAuditModalOpen] = useState(false);
  const [editingAuditItem, setEditingAuditItem] = useState(null);
  const [auditForm, setAuditForm] = useState({
    name: '',
    unit: 'جرام',
    stockQuantity: '1000',
    minThreshold: '200',
    requiresAudit: true
  });
  const [isSavingAuditItem, setIsSavingAuditItem] = useState(false);

  // Load Products
  const loadProducts = useCallback(async () => {
    setProductsLoading(true);
    try {
      const data = await menuApi.getProducts();
      setProducts(data.filter(p => p.trackInventory || p.available));
    } catch (err) {
      toast.error(err.message, 'فشل تحميل بيانات المنتجات');
    } finally {
      setProductsLoading(false);
    }
  }, [toast]);

  // Load Shift Audit Raw Materials
  const loadAuditItems = useCallback(async () => {
    setAuditItemsLoading(true);
    try {
      const data = await auditApi.getAuditItems();
      setAuditItems(data || []);
    } catch (err) {
      toast.error(err.message, 'فشل تحميل خامات الجرد');
    } finally {
      setAuditItemsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadProducts();
    loadAuditItems();
  }, [loadProducts, loadAuditItems]);

  // Product Stock adjustment handlers
  function handleOpenAdjustmentModal(product) {
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
      await client.post(`/products/${selectedProduct.id}/stock-adjustments`, {
        type: diff > 0 ? 'CORRECTION' : 'WASTE',
        quantityChange: diff,
        reason: adjustmentReason || 'جرد وتعديل يدوي'
      });

      toast.success('تم تحديث جرد المنتج بنجاح');
      setIsModalOpen(false);
      loadProducts();
    } catch (err) {
      toast.error(err.message, 'خطأ في حفظ الجرد');
    } finally {
      setIsSaving(false);
    }
  }

  // Audit Item Create/Edit Modal
  function handleOpenAuditModal(item = null) {
    if (item) {
      setEditingAuditItem(item);
      setAuditForm({
        name: item.name,
        unit: item.unit || 'جرام',
        stockQuantity: String(item.stockQuantity ?? 0),
        minThreshold: String(item.minThreshold ?? 0),
        requiresAudit: item.requiresAudit ?? true
      });
    } else {
      setEditingAuditItem(null);
      setAuditForm({
        name: '',
        unit: 'جرام',
        stockQuantity: '1000',
        minThreshold: '200',
        requiresAudit: true
      });
    }
    setIsAuditModalOpen(true);
  }

  async function handleSaveAuditItem(e) {
    e.preventDefault();
    if (!auditForm.name.trim()) return;

    setIsSavingAuditItem(true);
    try {
      const payload = {
        id: editingAuditItem ? editingAuditItem.id : null,
        name: auditForm.name.trim(),
        unit: auditForm.unit,
        stockQuantity: parseFloat(auditForm.stockQuantity) || 0,
        minThreshold: parseFloat(auditForm.minThreshold) || 0,
        requiresAudit: auditForm.requiresAudit,
        active: true
      };

      await auditApi.saveAuditItem(payload);
      toast.success(editingAuditItem ? 'تم تحديث الخامة بنجاح' : 'تم إضافة خامة جديدة للجرد');
      setIsAuditModalOpen(false);
      loadAuditItems();
    } catch (err) {
      toast.error(err.message, 'خطأ في حفظ الخامة');
    } finally {
      setIsSavingAuditItem(false);
    }
  }

  async function handleDeleteAuditItem(item) {
    if (!window.confirm(`هل أنت تأكد من حذف خامة الجرد "${item.name}"؟`)) return;

    try {
      await auditApi.deleteAuditItem(item.id);
      toast.success('تم حذف الخامة بنجاح');
      loadAuditItems();
    } catch (err) {
      toast.error(err.message, 'فشل حذف الخامة');
    }
  }

  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="page inventory-page">
      <ObserverBanner />
      
      <div className="page__header">
        <div>
          <h1 className="page__title">الجرد والمخزون والخامات</h1>
          <p className="page__subtitle">إدارة خامات الجرد (القهوة، اللبن) وتتبع المخزون المعياري بالشيفت</p>
        </div>
        
        {isSupervisor && activeTab === 'audit-items' && (
          <Button variant="primary" icon={<Plus size={16} />} onClick={() => handleOpenAuditModal()}>
            إضافة خامة جديدة للجرد
          </Button>
        )}
      </div>

      {/* Tabs */}
      <div className="inventory-tabs" style={{ display: 'flex', gap: '12px', marginBottom: '20px', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '10px' }}>
        <button
          className={`btn-tab ${activeTab === 'audit-items' ? 'active' : ''}`}
          onClick={() => setActiveTab('audit-items')}
          style={{
            padding: '10px 20px',
            borderRadius: '8px',
            border: 'none',
            background: activeTab === 'audit-items' ? 'var(--accent)' : 'var(--bg-secondary)',
            color: activeTab === 'audit-items' ? '#fff' : 'var(--text-secondary)',
            fontWeight: '600',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          <Coffee size={18} />
          خامات جرد الشيفت المعيارية (القهوة، اللبن، السكر)
          <span style={{ background: 'rgba(255,255,255,0.2)', padding: '2px 8px', borderRadius: '12px', fontSize: '0.8rem' }}>
            {auditItems.length}
          </span>
        </button>

        <button
          className={`btn-tab ${activeTab === 'products' ? 'active' : ''}`}
          onClick={() => setActiveTab('products')}
          style={{
            padding: '10px 20px',
            borderRadius: '8px',
            border: 'none',
            background: activeTab === 'products' ? 'var(--accent)' : 'var(--bg-secondary)',
            color: activeTab === 'products' ? '#fff' : 'var(--text-secondary)',
            fontWeight: '600',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          <Package size={18} />
          تعديل جرد المنتجات الجاهزة (المشروبات والساندوتشات)
        </button>
      </div>

      {/* Tab 1: Raw Material Audit Items */}
      {activeTab === 'audit-items' && (
        <div className="data-table-wrap">
          {auditItemsLoading ? (
            <div className="data-table-empty"><Spinner /></div>
          ) : auditItems.length === 0 ? (
            <div className="data-table-empty" style={{ textAlign: 'center', padding: '40px' }}>
              <Coffee size={48} style={{ opacity: 0.3, marginBottom: '12px' }} />
              <p style={{ fontSize: '1.1rem', fontWeight: 'bold' }}>لا توجد خامات مخصصة للجرد حالياً.</p>
              <p style={{ color: 'var(--text-muted)', marginBottom: '16px' }}>اضغط على زر "إضافة خامة جديدة للجرد" لإضافة الخامات التي تود جردها عند فتح وإغلاق الشيفت (مثل القهوة، اللبن، الأكواب).</p>
              {isSupervisor && (
                <Button variant="primary" icon={<Plus size={16} />} onClick={() => handleOpenAuditModal()}>
                  إضافة أول خامة للجرد الآن 🚀
                </Button>
              )}
            </div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>اسم الخامة المجرودة</th>
                  <th>وحدة القياس</th>
                  <th>الكمية بالمخزن</th>
                  <th>مستوى الخامة وشريط التقدم 📊</th>
                  <th>حد التنبيه الأدنى</th>
                  <th>مطلوبة بالشيفت؟</th>
                  {isSupervisor && <th style={{ textAlign: 'left' }}>التحكم</th>}
                </tr>
              </thead>
              <tbody>
                {auditItems.map((item) => {
                  const maxEst = (item.minThreshold && item.minThreshold > 0) ? item.minThreshold * 5 : 1000;
                  const ratio = Math.min(100, Math.max(0, ((item.stockQuantity || 0) / maxEst) * 100));
                  const isLow = (item.stockQuantity || 0) <= (item.minThreshold || 0);

                  return (
                    <tr key={item.id}>
                      <td style={{ fontWeight: 'bold', fontSize: '1rem' }}>
                        ☕ {item.name}
                      </td>
                      <td><Badge variant="neutral">{item.unit}</Badge></td>
                      <td className="data-table__number" style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>
                        {item.stockQuantity} {item.unit}
                      </td>
                      {/* Visual Progress Bar */}
                      <td style={{ minWidth: '180px' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', fontWeight: '600' }}>
                            <span style={{ color: isLow ? '#ef4444' : ratio > 50 ? '#10b981' : '#f59e0b' }}>
                              {isLow ? '⚠️ قارب على النفاد!' : ratio > 50 ? 'ممتاز' : 'منخفض'}
                            </span>
                            <span>{Math.round(ratio)}%</span>
                          </div>
                          <div style={{ height: '8px', background: 'rgba(255,255,255,0.08)', borderRadius: '4px', overflow: 'hidden' }}>
                            <div 
                              style={{
                                height: '100%',
                                width: `${ratio}%`,
                                background: isLow 
                                  ? 'linear-gradient(90deg, #ef4444, #dc2626)' 
                                  : ratio > 50 
                                    ? 'linear-gradient(90deg, #10b981, #059669)' 
                                    : 'linear-gradient(90deg, #f59e0b, #d97706)',
                                transition: 'width 0.4s ease',
                                borderRadius: '4px'
                              }}
                            />
                          </div>
                        </div>
                      </td>
                      <td>{item.minThreshold} {item.unit}</td>
                      <td>
                        {item.requiresAudit ? (
                          <Badge variant="success">نعم - يطلب الجرد بفتح الشيفت</Badge>
                        ) : (
                          <Badge variant="secondary">لا</Badge>
                        )}
                      </td>
                      {isSupervisor && (
                        <td>
                          <div className="data-table__actions" style={{ justifyContent: 'flex-end', gap: '8px' }}>
                            <Button variant="secondary" size="sm" icon={<Edit size={14} />} onClick={() => handleOpenAuditModal(item)}>
                              تعديل
                            </Button>
                            <Button variant="danger" size="sm" icon={<Trash2 size={14} />} onClick={() => handleDeleteAuditItem(item)}>
                              حذف
                            </Button>
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Tab 2: Products Stock Adjustment */}
      {activeTab === 'products' && (
        <>
          <div className="inventory-filters">
            <div className="inventory-search">
              <Search size={16} className="inventory-search__icon" />
              <input
                type="text"
                className="inventory-search__input"
                placeholder="ابحث عن منتج..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>

          <div className="data-table-wrap">
            {productsLoading ? (
              <div className="data-table-empty"><Spinner /></div>
            ) : filteredProducts.length === 0 ? (
              <div className="data-table-empty">لا توجد منتجات خاضعة للجرد. قم بتفعيل "تتبع المخزون" للمنتجات من صفحة المنتجات.</div>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>اسم المنتج</th>
                    <th>التصنيف</th>
                    <th>الكمية المسجلة</th>
                    <th>شريط المخزون 📊</th>
                    <th>الحالة</th>
                    <th style={{ textAlign: 'left' }}>التحكم</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredProducts.map((prod) => {
                    const threshold = prod.minStockThreshold || 10;
                    const ratio = Math.min(100, Math.max(0, ((prod.stockQuantity || 0) / (threshold * 3)) * 100));
                    const isLow = (prod.stockQuantity || 0) <= threshold;

                    return (
                      <tr key={prod.id} data-stock={prod.stockQuantity <= 0 ? 'danger' : prod.stockQuantity <= 10 ? 'warning' : 'good'}>
                        <td style={{ fontWeight: 500 }}>{prod.name}</td>
                        <td>{prod.categoryName}</td>
                        <td className="data-table__number" style={{ fontSize: '1.1rem', fontWeight: 'bold' }}>
                          {prod.stockQuantity}
                        </td>
                        {/* Progress bar column */}
                        <td style={{ minWidth: '160px' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', fontWeight: '600' }}>
                              <span style={{ color: isLow ? '#ef4444' : ratio > 50 ? '#10b981' : '#f59e0b' }}>
                                {prod.stockQuantity <= 0 ? 'نفذ بالكامل' : isLow ? 'منخفض جداً' : 'متوفر'}
                              </span>
                              <span>{Math.round(ratio)}%</span>
                            </div>
                            <div style={{ height: '8px', background: 'rgba(255,255,255,0.08)', borderRadius: '4px', overflow: 'hidden' }}>
                              <div 
                                style={{
                                  height: '100%',
                                  width: `${ratio}%`,
                                  background: prod.stockQuantity <= 0 
                                    ? '#ef4444'
                                    : isLow 
                                      ? 'linear-gradient(90deg, #ef4444, #f59e0b)' 
                                      : 'linear-gradient(90deg, #10b981, #059669)',
                                  transition: 'width 0.4s ease',
                                  borderRadius: '4px'
                                }}
                              />
                            </div>
                          </div>
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
                            {isSupervisor && (
                              <Button variant="secondary" size="sm" onClick={() => handleOpenAdjustmentModal(prod)}>
                                تسوية جرد
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
        </>
      )}

      {/* Audit Item Create/Edit Modal */}
      <Modal
        isOpen={isAuditModalOpen}
        onClose={() => setIsAuditModalOpen(false)}
        title={editingAuditItem ? `تعديل خامة للجرد: ${editingAuditItem.name}` : 'إضافة خامة جديدة لجرد الشيفت'}
        size="md"
      >
        <form onSubmit={handleSaveAuditItem} className="form-grid">
          <Input
            label="اسم الخامة (مثال: بن قهوة إسبرسو / حليب طازج / سكر / أكواب)"
            type="text"
            value={auditForm.name}
            onChange={(e) => setAuditForm({ ...auditForm, name: e.target.value })}
            placeholder="أدخل اسم الخامة..."
            required
          />

          <div className="input-group">
            <label className="input-label">وحدة القياس</label>
            <select
              className="input-field"
              value={auditForm.unit}
              onChange={(e) => setAuditForm({ ...auditForm, unit: e.target.value })}
              style={{ width: '100%', height: '42px', borderRadius: '8px', background: 'var(--bg-primary)', color: 'var(--text-primary)', border: '1px solid var(--border-default)', padding: '0 12px' }}
            >
              <option value="جرام">جرام (g)</option>
              <option value="كيلو">كيلو جرام (kg)</option>
              <option value="لتر">لتر (L)</option>
              <option value="ملي">ملي لتر (ml)</option>
              <option value="قطعة">قطعة (pcs)</option>
              <option value="كيس">كيس / علبة</option>
            </select>
          </div>

          <Input
            label="الكمية الافتراضية بالمخزن حالياً"
            type="number"
            step="any"
            value={auditForm.stockQuantity}
            onChange={(e) => setAuditForm({ ...auditForm, stockQuantity: e.target.value })}
            required
          />

          <Input
            label="الحد الأدنى للتنبيه عند النقص"
            type="number"
            step="any"
            value={auditForm.minThreshold}
            onChange={(e) => setAuditForm({ ...auditForm, minThreshold: e.target.value })}
          />

          <div style={{ gridColumn: '1 / -1', margin: '10px 0' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={auditForm.requiresAudit}
                onChange={(e) => setAuditForm({ ...auditForm, requiresAudit: e.target.checked })}
                style={{ width: '18px', height: '18px' }}
              />
              <span style={{ fontWeight: '500' }}>مطلوب جرد هذه الخامة وسؤال الكاشير عنها عند فتح وإغلاق الشيفت</span>
            </label>
          </div>

          <div className="form-actions" style={{ gridColumn: '1 / -1', marginTop: '16px', display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
            <Button type="button" variant="secondary" onClick={() => setIsAuditModalOpen(false)}>إلغاء</Button>
            <Button type="submit" loading={isSavingAuditItem}>حفظ الخامة</Button>
          </div>
        </form>
      </Modal>

      {/* Product Stock Adjustment Modal */}
      {selectedProduct && (
        <Modal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          title={`تسوية جرد المنتج: ${selectedProduct.name}`}
          size="sm"
        >
          <form onSubmit={handleSaveAdjustment} className="form-grid">
            <div className="inventory-qty-info" style={{ gridColumn: '1 / -1' }}>
              <span className="inventory-qty-info__label">الكمية المسجلة حالياً بالبرنامج:</span>
              <strong className="inventory-qty-info__value">{selectedProduct.stockQuantity}</strong>
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
