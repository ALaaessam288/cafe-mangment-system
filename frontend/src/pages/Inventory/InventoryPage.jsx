import { useCallback, useEffect, useState, useMemo } from 'react';
import { Package, Search, Plus, Trash2, Edit, Coffee, CheckCircle, AlertTriangle, FlaskConical } from 'lucide-react';
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

  const [activeTab, setActiveTab] = useState('recipes');
  const [products, setProducts] = useState([]);
  const [allProducts, setAllProducts] = useState([]);
  const [productsLoading, setProductsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [actualQuantity, setActualQuantity] = useState('');
  const [adjustmentReason, setAdjustmentReason] = useState('');
  const [isSaving, setIsSaving] = useState(false);

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

  const [allRecipes, setAllRecipes] = useState([]);
  const [recipesLoading, setRecipesLoading] = useState(true);
  const [isRecipeModalOpen, setIsRecipeModalOpen] = useState(false);
  const [recipeSelectedProductId, setRecipeSelectedProductId] = useState('');
  const [recipeItems, setRecipeItems] = useState([]);
  const [newIngredient, setNewIngredient] = useState({ auditItemId: '', deductionQuantity: '' });
  const [isSavingRecipe, setIsSavingRecipe] = useState(false);

  const loadProducts = useCallback(async () => {
    setProductsLoading(true);
    try {
      const data = await menuApi.getProducts();
      setAllProducts(data || []);
      setProducts((data || []).filter(p => p.trackInventory || p.available));
    } catch (err) {
      toast.error(err.message, 'فشل تحميل بيانات المنتجات');
    } finally {
      setProductsLoading(false);
    }
  }, [toast]);

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

  const loadRecipes = useCallback(async () => {
    setRecipesLoading(true);
    try {
      const data = await auditApi.getAllRecipes();
      setAllRecipes(data || []);
    } catch (err) {
      console.warn('Failed to load all recipes:', err);
    } finally {
      setRecipesLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProducts();
    loadAuditItems();
    loadRecipes();
  }, [loadProducts, loadAuditItems, loadRecipes]);

  const recipesByProduct = useMemo(() => {
    const map = new Map();
    for (const r of allRecipes) {
      if (!map.has(r.productId)) {
        map.set(r.productId, {
          productId: r.productId,
          productName: r.productName,
          items: []
        });
      }
      map.get(r.productId).items.push(r);
    }
    return Array.from(map.values());
  }, [allRecipes]);

  const filteredRecipes = useMemo(() => {
    if (!searchTerm.trim()) return recipesByProduct;
    const term = searchTerm.toLowerCase();
    return recipesByProduct.filter(rp => {
      const name = (rp.productName || '').toLowerCase();
      const hasItem = rp.items.some(i => (i.auditItemName || '').toLowerCase().includes(term));
      return name.includes(term) || hasItem;
    });
  }, [recipesByProduct, searchTerm]);

  const filteredProducts = useMemo(() => {
    if (!searchTerm.trim()) return products;
    const term = searchTerm.toLowerCase();
    return products.filter(p => (p.name || '').toLowerCase().includes(term));
  }, [products, searchTerm]);

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
      await client.post('/products/' + selectedProduct.id + '/stock-adjustments', {
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

  function handleOpenAuditModal(item = null) {
    if (item) {
      setEditingAuditItem(item);
      setAuditForm({
        name: item.name || '',
        unit: item.unit || 'جرام',
        stockQuantity: item.currentStock !== undefined ? String(item.currentStock) : '1000',
        minThreshold: item.alertThreshold !== undefined ? String(item.alertThreshold) : '200',
        requiresAudit: true
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
    if (!auditForm.name.trim()) {
      toast.error('يرجى إدخال اسم الخامة');
      return;
    }
    setIsSavingAuditItem(true);
    try {
      const payload = {
        id: editingAuditItem ? editingAuditItem.id : undefined,
        name: auditForm.name.trim(),
        unit: auditForm.unit.trim(),
        currentStock: parseFloat(auditForm.stockQuantity) || 0,
        alertThreshold: parseFloat(auditForm.minThreshold) || 0,
        active: true
      };
      await auditApi.saveAuditItem(payload);
      toast.success(editingAuditItem ? 'تم تعديل الخامة بنجاح' : 'تمت إضافة خامة الجرد بنجاح');
      setIsAuditModalOpen(false);
      loadAuditItems();
    } catch (err) {
      toast.error(err.message, 'فشل حفظ خامة الجرد');
    } finally {
      setIsSavingAuditItem(false);
    }
  }

  async function handleDeleteAuditItem(item) {
    if (!window.confirm('هل أنت متأكد من حذف خامة الجرد ' + item.name + '؟')) return;
    try {
      await auditApi.deleteAuditItem(item.id);
      toast.success('تم حذف الخامة بنجاح');
      loadAuditItems();
      loadRecipes();
    } catch (err) {
      toast.error(err.message, 'فشل حذف الخامة');
    }
  }

  async function handleOpenRecipeModal(productId = null) {
    if (productId) {
      setRecipeSelectedProductId(String(productId));
      try {
        const data = await auditApi.getProductRecipes(productId);
        setRecipeItems(data || []);
      } catch (err) {
        setRecipeItems([]);
      }
    } else {
      setRecipeSelectedProductId('');
      setRecipeItems([]);
    }
    setNewIngredient({ auditItemId: '', deductionQuantity: '' });
    setIsRecipeModalOpen(true);
  }

  async function handleSelectProductForRecipe(productId) {
    setRecipeSelectedProductId(productId);
    if (!productId) {
      setRecipeItems([]);
      return;
    }
    try {
      const data = await auditApi.getProductRecipes(productId);
      setRecipeItems(data || []);
    } catch (err) {
      setRecipeItems([]);
    }
  }

  function handleAddIngredientRow() {
    if (!newIngredient.auditItemId || !newIngredient.deductionQuantity) {
      toast.warning('اختر الخامة وحدد الكمية المستهلكة');
      return;
    }
    const auditItem = auditItems.find(i => String(i.id) === String(newIngredient.auditItemId));
    if (!auditItem) return;
    if (recipeItems.some(i => String(i.auditItemId) === String(newIngredient.auditItemId))) {
      toast.warning('هذه الخامة مضافة بالفعل في الوصفة');
      return;
    }
    setRecipeItems([
      ...recipeItems,
      {
        auditItemId: auditItem.id,
        auditItemName: auditItem.name,
        auditItemUnit: auditItem.unit,
        deductionQuantity: parseFloat(newIngredient.deductionQuantity)
      }
    ]);
    setNewIngredient({ auditItemId: '', deductionQuantity: '' });
  }

  function handleRemoveIngredientRow(auditItemId) {
    setRecipeItems(recipeItems.filter(i => i.auditItemId !== auditItemId));
  }

  async function handleSaveRecipeForm(e) {
    e.preventDefault();
    if (!recipeSelectedProductId) {
      toast.error('يرجى اختيار المنتج أولاً');
      return;
    }
    setIsSavingRecipe(true);
    try {
      const dtos = recipeItems.map(item => ({
        productId: Number(recipeSelectedProductId),
        auditItemId: item.auditItemId,
        deductionQuantity: Number(item.deductionQuantity)
      }));
      await auditApi.saveProductRecipes(recipeSelectedProductId, dtos);
      const prodName = allProducts.find(p => String(p.id) === String(recipeSelectedProductId))?.name || '';
      toast.success('تم حفظ مقادير ومكونات «' + prodName + '» بنجاح 🧪');
      setIsRecipeModalOpen(false);
      loadRecipes();
    } catch (err) {
      toast.error(err.message, 'فشل حفظ وصفة المنتج');
    } finally {
      setIsSavingRecipe(false);
    }
  }

  async function handleDeleteEntireRecipe(productId, productName) {
    if (!window.confirm('هل أنت متأكد من حذف مقادير ووصفة «' + (productName || 'المنتج') + '»؟')) return;
    try {
      await auditApi.saveProductRecipes(productId, []);
      toast.success('تم حذف مقادير المنتج بنجاح');
      loadRecipes();
    } catch (err) {
      toast.error(err.message, 'فشل حذف الوصفة');
    }
  }

  return (
    <div className="page inventory-page">
      <ObserverBanner />
      <div className="page__header">
        <div>
          <h1 className="page__title">الجرد، الوصفات والمخزون</h1>
          <p className="page__subtitle">إدارة مقادير ووصفات الأصناف (Recipes)، خامات الجرد (القهوة، اللبن)، ومخزون المنتجات</p>
        </div>
        {isSupervisor && (
          <div style={{ display: 'flex', gap: '8px' }}>
            {activeTab === 'recipes' && (
              <Button variant="primary" icon={<Plus size={16} />} onClick={() => handleOpenRecipeModal()}>
                + تعيين مقادير صنف جديد (Recipe)
              </Button>
            )}
            {activeTab === 'audit-items' && (
              <Button variant="primary" icon={<Plus size={16} />} onClick={() => handleOpenAuditModal()}>
                إضافة خامة جديدة للجرد
              </Button>
            )}
          </div>
        )}
      </div>

      <div className="inventory-tabs" style={{ display: 'flex', gap: '10px', marginBottom: '20px', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '12px', flexWrap: 'wrap' }}>
        <button
          className={'btn-tab ' + (activeTab === 'recipes' ? 'active' : '')}
          onClick={() => setActiveTab('recipes')}
          style={{
            padding: '10px 18px',
            borderRadius: '8px',
            border: 'none',
            background: activeTab === 'recipes' ? 'var(--accent)' : 'var(--bg-secondary)',
            color: activeTab === 'recipes' ? '#fff' : 'var(--text-secondary)',
            fontWeight: '700',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          <FlaskConical size={18} />
          🧪 وصفات ومقادير الأصناف (Recipes)
          <span style={{ background: 'rgba(255,255,255,0.25)', padding: '2px 8px', borderRadius: '12px', fontSize: '0.8rem' }}>
            {recipesByProduct.length}
          </span>
        </button>

        <button
          className={'btn-tab ' + (activeTab === 'audit-items' ? 'active' : '')}
          onClick={() => setActiveTab('audit-items')}
          style={{
            padding: '10px 18px',
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
          className={'btn-tab ' + (activeTab === 'products' ? 'active' : '')}
          onClick={() => setActiveTab('products')}
          style={{
            padding: '10px 18px',
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

      {activeTab === 'recipes' && (
        <div className="recipes-tab-content">
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: '12px',
            marginBottom: '20px'
          }}>
            <div style={{ background: 'var(--bg-secondary)', padding: '16px', borderRadius: '10px', border: '1px solid var(--border-subtle)' }}>
              <div style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>الأصناف المربوطة بمقادير</div>
              <div style={{ fontSize: '24px', fontWeight: '800', color: 'var(--accent)', marginTop: '4px' }}>
                {recipesByProduct.length} <span style={{ fontSize: '14px', fontWeight: 'normal', color: 'var(--text-secondary)' }}>صنف</span>
              </div>
            </div>
            <div style={{ background: 'var(--bg-secondary)', padding: '16px', borderRadius: '10px', border: '1px solid var(--border-subtle)' }}>
              <div style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>إجمالي الخامات المسجلة</div>
              <div style={{ fontSize: '24px', fontWeight: '800', color: '#10b981', marginTop: '4px' }}>
                {auditItems.length} <span style={{ fontSize: '14px', fontWeight: 'normal', color: 'var(--text-secondary)' }}>خامة مستودع</span>
              </div>
            </div>
            <div style={{ background: 'var(--bg-secondary)', padding: '16px', borderRadius: '10px', border: '1px solid var(--border-subtle)' }}>
              <div style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>آلية الخصم التلقائي</div>
              <div style={{ fontSize: '13px', fontWeight: '600', color: '#38bdf8', marginTop: '6px' }}>
                ⚡ يخصم المقادير آلياً من رصيد الخامات في تقرير جرد الشيفت عند البيع
              </div>
            </div>
          </div>

          <div className="filter-bar" style={{ marginBottom: '16px', display: 'flex', gap: '12px', alignItems: 'center' }}>
            <div className="search-box" style={{ flex: 1, maxWidth: '400px', position: 'relative' }}>
              <Search size={18} className="search-box__icon" style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                type="text"
                className="input input--search"
                placeholder="ابحث باسم المنتج أو الخامة..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{ width: '100%', paddingRight: '40px' }}
              />
            </div>
          </div>

          <div className="data-table-wrap">
            {recipesLoading ? (
              <div className="data-table-empty"><Spinner /></div>
            ) : filteredRecipes.length === 0 ? (
              <div className="data-table-empty" style={{ padding: '40px 20px', textAlign: 'center' }}>
                <FlaskConical size={48} style={{ opacity: 0.3, marginBottom: '12px', margin: '0 auto' }} />
                <div style={{ fontSize: '16px', fontWeight: 600, marginBottom: '6px' }}>لا توجد وصفات أو مقادير مضافة حالياً</div>
                <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '16px' }}>
                  اضغط على الزر أدناه لتحديد مقادير أي مشروب أو وجبة (مثال: آيس كوفي = 30ml لبن + 15g بن + 10g سكر)
                </p>
                {isSupervisor && (
                  <Button variant="primary" onClick={() => handleOpenRecipeModal()}>
                    + تعيين أول وصفة لمنتج
                  </Button>
                )}
              </div>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>اسم المنتج / الصنف</th>
                    <th>المقادير والخامات المستهلكة لكل أوردر</th>
                    <th>عدد المكونات</th>
                    <th style={{ textAlign: 'left' }}>الإجراءات</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRecipes.map((rp) => {
                    const prod = allProducts.find(p => p.id === rp.productId);
                    return (
                      <tr key={rp.productId}>
                        <td style={{ fontWeight: 700, fontSize: '15px' }}>
                          {rp.productName || prod?.name || ('منتج #' + rp.productId)}
                          {prod?.categoryNameAr && (
                            <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', fontWeight: 'normal' }}>
                              قسم: {prod.categoryNameAr}
                            </span>
                          )}
                        </td>
                        <td>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                            {rp.items.map(item => (
                              <span
                                key={item.id || item.auditItemId}
                                style={{
                                  background: 'var(--bg-surface-hover)',
                                  border: '1px solid var(--border-color)',
                                  borderRadius: '6px',
                                  padding: '4px 10px',
                                  fontSize: '12px',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px'
                                }}
                              >
                                <strong style={{ color: 'var(--accent)' }}>{item.auditItemName || 'خامة'}</strong>: {item.deductionQuantity} {item.auditItemUnit || ''}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td>
                          <Badge variant="neutral">{rp.items.length} مكونات</Badge>
                        </td>
                        <td>
                          <div className="data-table__actions" style={{ justifyContent: 'flex-end', gap: '6px' }}>
                            {isSupervisor && (
                              <>
                                <Button
                                  variant="secondary"
                                  size="sm"
                                  onClick={() => handleOpenRecipeModal(rp.productId)}
                                  icon={<Edit size={14} />}
                                >
                                  تعديل المقادير
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleDeleteEntireRecipe(rp.productId, rp.productName || prod?.name)}
                                  style={{ color: 'var(--danger)' }}
                                  icon={<Trash2 size={14} />}
                                >
                                  حذف
                                </Button>
                              </>
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
        </div>
      )}

      {activeTab === 'audit-items' && (
        <div className="audit-items-tab-content">
          <div className="data-table-wrap">
            {auditItemsLoading ? (
              <div className="data-table-empty"><Spinner /></div>
            ) : auditItems.length === 0 ? (
              <div className="data-table-empty">مفيش خامات جرد مسجلة حالياً. اضغط "إضافة خامة جديدة للجرد" للبدء.</div>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>اسم الخامة</th>
                    <th>الوحدة المعيارية</th>
                    <th>الرصيد الحالي بالمستودع</th>
                    <th>حد التنبيه الحرج</th>
                    <th style={{ textAlign: 'left' }}>الإجراءات</th>
                  </tr>
                </thead>
                <tbody>
                  {auditItems.map((item) => (
                    <tr key={item.id}>
                      <td style={{ fontWeight: 600 }}>{item.name}</td>
                      <td>
                        <Badge variant="neutral">{item.unit}</Badge>
                      </td>
                      <td>
                        <span style={{ fontSize: '15px', fontWeight: 'bold' }}>{item.currentStock || 0}</span> {item.unit}
                      </td>
                      <td>
                        <span style={{ color: 'var(--text-muted)' }}>{item.alertThreshold || 0} {item.unit}</span>
                      </td>
                      <td>
                        <div className="data-table__actions" style={{ justifyContent: 'flex-end' }}>
                          {isSupervisor && (
                            <>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleOpenAuditModal(item)}
                              >
                                <Edit size={16} />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDeleteAuditItem(item)}
                                style={{ color: 'var(--danger)' }}
                              >
                                <Trash2 size={16} />
                              </Button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {activeTab === 'products' && (
        <div className="products-tab-content">
          <div className="filter-bar" style={{ marginBottom: '16px' }}>
            <div className="search-box">
              <Search size={18} className="search-box__icon" />
              <input
                type="text"
                className="input input--search"
                placeholder="ابحث باسم المنتج..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>

          <div className="data-table-wrap">
            {productsLoading ? (
              <div className="data-table-empty"><Spinner /></div>
            ) : filteredProducts.length === 0 ? (
              <div className="data-table-empty">مفيش منتجات متطابقة مع البحث</div>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>اسم المنتج</th>
                    <th>القسم</th>
                    <th>المخزون المسجل بالبرنامج</th>
                    <th>حالة التتبع</th>
                    <th style={{ textAlign: 'left' }}>الإجراءات</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredProducts.map((p) => (
                    <tr key={p.id}>
                      <td style={{ fontWeight: 500 }}>{p.name}</td>
                      <td>{p.categoryNameAr || '-'}</td>
                      <td>
                        <span style={{
                          fontWeight: 'bold',
                          color: (p.stockQuantity || 0) <= 0 ? 'var(--danger)' : (p.stockQuantity || 0) <= (p.minStockThreshold || 5) ? '#f59e0b' : 'var(--text-primary)'
                        }}>
                          {p.stockQuantity ?? 0}
                        </span>
                      </td>
                      <td>
                        {p.trackInventory ? (
                          <Badge variant="success">مفعل</Badge>
                        ) : (
                          <Badge variant="neutral">غير مفعل</Badge>
                        )}
                      </td>
                      <td>
                        <div className="data-table__actions" style={{ justifyContent: 'flex-end' }}>
                          {isSupervisor && (
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => handleOpenAdjustmentModal(p)}
                            >
                              تسوية الجرد (تعديل الكمية)
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
        </div>
      )}

      {isRecipeModalOpen && (
        <Modal
          isOpen={isRecipeModalOpen}
          onClose={() => setIsRecipeModalOpen(false)}
          title="🧪 تعيين مقادير ووصفة المنتج (Recipe)"
          size="md"
        >
          <form onSubmit={handleSaveRecipeForm} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label className="field-select__label" style={{ fontWeight: 600, marginBottom: '6px', display: 'block' }}>اختر المنتج</label>
              <select
                className="field-select__control input"
                value={recipeSelectedProductId}
                onChange={(e) => handleSelectProductForRecipe(e.target.value)}
                required
                style={{ width: '100%', height: '42px', fontSize: '15px' }}
              >
                <option value="">-- اختر المنتج --</option>
                {allProducts.map((prod) => (
                  <option key={prod.id} value={prod.id}>
                    {prod.name} {prod.categoryNameAr ? '(' + prod.categoryNameAr + ')' : ''}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ background: 'var(--bg-surface-hover)', padding: '16px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
              <div style={{ fontWeight: 600, fontSize: '13px', marginBottom: '10px' }}>+ إضافة مكون / خامة للوصفة</div>
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr auto', gap: '10px', alignItems: 'flex-end' }}>
                <div>
                  <label style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>الخامة</label>
                  <select
                    className="input"
                    value={newIngredient.auditItemId}
                    onChange={(e) => setNewIngredient({ ...newIngredient, auditItemId: e.target.value })}
                    style={{ width: '100%', height: '38px' }}
                  >
                    <option value="">-- اختر الخامة --</option>
                    {auditItems.map(item => (
                      <option key={item.id} value={item.id}>{item.name} ({item.unit})</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                    الكمية ({auditItems.find(i => String(i.id) === String(newIngredient.auditItemId))?.unit || 'المقدار'})
                  </label>
                  <input
                    type="number"
                    step="0.001"
                    min="0.001"
                    placeholder="مثال: 15"
                    className="input"
                    value={newIngredient.deductionQuantity}
                    onChange={(e) => setNewIngredient({ ...newIngredient, deductionQuantity: e.target.value })}
                    style={{ width: '100%', height: '38px' }}
                  />
                </div>
                <Button type="button" onClick={handleAddIngredientRow} style={{ height: '38px' }}>
                  + إضافة
                </Button>
              </div>
            </div>

            <div>
              <label style={{ fontWeight: 600, fontSize: '13px', display: 'block', marginBottom: '8px' }}>
                المقادير المضافة في هذه الوصفة ({recipeItems.length}):
              </label>
              {recipeItems.length === 0 ? (
                <div style={{ padding: '20px', textAlign: 'center', background: 'var(--bg-secondary)', borderRadius: '6px', color: 'var(--text-muted)', fontSize: '13px' }}>
                  لم يتم إضافة أي خامات بعد. اختر الخامة وحدد الكمية بالأعلى ثم اضغط "+ إضافة".
                </div>
              ) : (
                <table className="data-table" style={{ fontSize: '13px' }}>
                  <thead>
                    <tr>
                      <th>الخامة</th>
                      <th>الكمية المستهلكة</th>
                      <th>الوحدة</th>
                      <th style={{ textAlign: 'left' }}>حذف</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recipeItems.map((item) => (
                      <tr key={item.auditItemId}>
                        <td style={{ fontWeight: 600 }}>{item.auditItemName}</td>
                        <td>
                          <input
                            type="number"
                            step="0.001"
                            min="0.001"
                            value={item.deductionQuantity}
                            onChange={(e) => {
                              const val = parseFloat(e.target.value) || 0;
                              setRecipeItems(recipeItems.map(i => i.auditItemId === item.auditItemId ? { ...i, deductionQuantity: val } : i));
                            }}
                            className="input"
                            style={{ width: '90px', padding: '4px 8px', height: '32px' }}
                          />
                        </td>
                        <td><Badge variant="neutral">{item.auditItemUnit}</Badge></td>
                        <td>
                          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                            <Button
                              variant="ghost"
                              size="sm"
                              type="button"
                              onClick={() => handleRemoveIngredientRow(item.auditItemId)}
                              style={{ color: 'var(--danger)', padding: '4px' }}
                            >
                              <Trash2 size={14} />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <div className="form-actions" style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '12px' }}>
              <Button type="button" variant="secondary" onClick={() => setIsRecipeModalOpen(false)}>إلغاء</Button>
              <Button type="submit" loading={isSavingRecipe} style={{ background: 'var(--accent)', borderColor: 'var(--accent)' }}>
                حفظ وصفة ومقادير الصنف 🧪
              </Button>
            </div>
          </form>
        </Modal>
      )}

      <Modal
        isOpen={isAuditModalOpen}
        onClose={() => setIsAuditModalOpen(false)}
        title={editingAuditItem ? 'تعديل خامة جرد' : 'إضافة خامة جرد جديدة للمستودع'}
        size="sm"
      >
        <form onSubmit={handleSaveAuditItem} className="form-grid">
          <Input
            label="اسم الخامة"
            placeholder="مثال: بن تركي، لبن طبيعي، سكر، سيرب كراميل"
            value={auditForm.name}
            onChange={(e) => setAuditForm({ ...auditForm, name: e.target.value })}
            required
          />

          <div className="field-select" style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label className="field-select__label">الوحدة المعيارية</label>
            <select
              className="field-select__control"
              value={auditForm.unit}
              onChange={(e) => setAuditForm({ ...auditForm, unit: e.target.value })}
            >
              <option value="جرام">جرام (g)</option>
              <option value="كيلو جرام">كيلو جرام (kg)</option>
              <option value="مليلتر">مليلتر (ml)</option>
              <option value="لتر">لتر (L)</option>
              <option value="قطعة">قطعة / حبة (piece)</option>
              <option value="كوب">كوب (cup)</option>
              <option value="زجاجة">زجاجة (bottle)</option>
              <option value="باكت">باكت / علبة (pack)</option>
            </select>
          </div>

          <Input
            label="الرصيد المتاح حالياً بالمستودع"
            type="number"
            value={auditForm.stockQuantity}
            onChange={(e) => setAuditForm({ ...auditForm, stockQuantity: e.target.value })}
            required
            min="0"
            step="0.01"
          />

          <Input
            label="حد التنبيه الحرج (تنبيه عند اقتراب النفاد)"
            type="number"
            value={auditForm.minThreshold}
            onChange={(e) => setAuditForm({ ...auditForm, minThreshold: e.target.value })}
            required
            min="0"
            step="0.01"
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

      {selectedProduct && (
        <Modal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          title={'تسوية جرد المنتج: ' + selectedProduct.name}
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
