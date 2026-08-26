import { useCallback, useEffect, useState, useMemo } from 'react';
import { Plus, Edit2, Search, Sliders, Trash2, ArrowUpDown } from 'lucide-react';
import { menuApi } from '../../api/menuApi';
import { stationsApi } from '../../api/stationsApi';
import { auditApi } from '../../api/auditApi';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';
import { formatCurrency } from '../../utils/formatters';
import Button from '../../components/Button/Button';
import Badge from '../../components/Badge/Badge';
import Modal from '../../components/Modal/Modal';
import Input from '../../components/Input/Input';
import Spinner from '../../components/Spinner/Spinner';
import ObserverBanner from '../../components/ObserverBanner/ObserverBanner';
import { ROLES } from '../../utils/constants';

const stationNames = {
  'KITCHEN': 'المطبخ',
  'BAR': 'البار',
  'OTHER': 'أخرى'
};

export default function ProductsPage() {
  const toast = useToast();
  const { role } = useAuth();
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [stations, setStations] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState('');
  const [filterCatId, setFilterCatId] = useState('');
  const [filterStationId, setFilterStationId] = useState('');
  const [filterAvailable, setFilterAvailable] = useState('ALL'); // ALL | AVAILABLE | UNAVAILABLE
  const [filterActive, setFilterActive] = useState('ALL'); // ALL | ACTIVE | INACTIVE
  const [sortBy, setSortBy] = useState('NAME_ASC');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [form, setForm] = useState({
    nameAr: '',
    nameEn: '',
    price: '',
    categoryId: '',
    stationId: '',
    revenueLine: 'BUFFET',
    available: true,
  });

  // Options Modal State
  const [isOptionsModalOpen, setIsOptionsModalOpen] = useState(false);
  const [optionsProduct, setOptionsProduct] = useState(null);
  const [productOptions, setProductOptions] = useState([]);
  const [optionsLoading, setOptionsLoading] = useState(false);
  const [newOptionForm, setNewOptionForm] = useState({ nameAr: '', priceDelta: '0', isDefault: false });
  const [isSavingOption, setIsSavingOption] = useState(false);

  // Recipes State
  const [auditItems, setAuditItems] = useState([]);
  const [productRecipes, setProductRecipes] = useState([]);
  const [newRecipeForm, setNewRecipeForm] = useState({ auditItemId: '', deductionQuantity: '' });
  const [recipesLoading, setRecipesLoading] = useState(false);

  const loadProductOptions = useCallback(async (productId) => {
    setOptionsLoading(true);
    try {
      const data = await menuApi.getOptions(productId);
      setProductOptions(data);
    } catch (err) {
      toast.error(err.message, 'فشل في تحميل الاختيارات');
    } finally {
      setOptionsLoading(false);
    }
  }, [toast]);

  async function handleAddOption(e) {
    e.preventDefault();
    if (!newOptionForm.nameAr.trim() || newOptionForm.priceDelta === '') return;
    
    const parsedPrice = parseFloat(newOptionForm.priceDelta);
    const optionPayload = {
      nameAr: newOptionForm.nameAr.trim(),
      priceDelta: isNaN(parsedPrice) ? 0 : parsedPrice,
      isDefault: newOptionForm.isDefault
    };

    if (editingProduct) {
      setIsSavingOption(true);
      try {
        await menuApi.createOption(editingProduct.id, optionPayload);
        toast.success('تمت إضافة الاختيار بنجاح');
        setNewOptionForm({ nameAr: '', priceDelta: '0', isDefault: false });
        await loadProductOptions(editingProduct.id);
      } catch (err) {
        toast.error(err.message, 'فشل إضافة الاختيار');
      } finally {
        setIsSavingOption(false);
      }
    } else {
      setProductOptions(prev => [...prev, {
        id: Date.now(),
        ...optionPayload
      }]);
      setNewOptionForm({ nameAr: '', priceDelta: '0', isDefault: false });
      toast.success('تمت إضافة الاختيار لقائمة الحفظ');
    }
  }

  async function handleDeleteOption(optionId) {
    if (editingProduct) {
      if (!window.confirm('هل أنت متأكد من مسح هذا الاختيار؟')) return;
      try {
        await menuApi.deleteOption(editingProduct.id, optionId);
        toast.success('تم مسح الاختيار بنجاح');
        await loadProductOptions(editingProduct.id);
      } catch (err) {
        toast.error(err.message, 'فشل مسح الاختيار');
      }
    } else {
      setProductOptions(prev => prev.filter(o => o.id !== optionId));
      toast.success('تم إزالة الاختيار من قائمة الحفظ');
    }
  }

  function handleAddRecipeItem(e) {
    e.preventDefault();
    if (!newRecipeForm.auditItemId || !newRecipeForm.deductionQuantity) return;

    const qty = parseFloat(newRecipeForm.deductionQuantity);
    if (isNaN(qty) || qty <= 0) {
      toast.warning('الرجاء إدخال كمية صحيحة');
      return;
    }

    const auditItem = auditItems.find(i => String(i.id) === String(newRecipeForm.auditItemId));
    if (!auditItem) return;

    // Check if already exists
    if (productRecipes.some(r => String(r.auditItemId) === String(auditItem.id))) {
      toast.warning('المكون مضاف بالفعل، يمكنك تعديله أو حذفه أولاً');
      return;
    }

    const newRecipe = {
      auditItemId: auditItem.id,
      auditItemName: auditItem.name,
      auditItemUnit: auditItem.unit,
      deductionQuantity: qty
    };

    setProductRecipes(prev => [...prev, newRecipe]);
    setNewRecipeForm({ auditItemId: '', deductionQuantity: '' });
  }

  function handleDeleteRecipeItem(auditItemId) {
    setProductRecipes(prev => prev.filter(r => String(r.auditItemId) !== String(auditItemId)));
  }

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      let [prods, cats, stns, items] = await Promise.all([
        menuApi.getProducts(),
        menuApi.getCategories(),
        stationsApi.findAll(),
        auditApi.getAuditItems().catch(() => [])
      ]);

      // Auto-create default stations if none exist
      if (stns.length === 0) {
        try {
          const s1 = await stationsApi.create({ code: 'KITCHEN', nameAr: 'المطبخ' });
          const s2 = await stationsApi.create({ code: 'BAR', nameAr: 'البار' });
          stns = [s1, s2];
        } catch (e) {
          console.error('Failed to auto-create default stations', e);
        }
      }

      setProducts(prods);
      setCategories(cats);
      setStations(stns);
      setAuditItems(items || []);
    } catch (err) {
      toast.error(err.message, 'Failed to load products');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { loadData(); }, [loadData]);

  // Derived filtered + sorted data
  const filteredProducts = useMemo(() => {
    const q = search.trim().toLowerCase();
    const result = products.filter((p) => {
      const matchesSearch = !q || (p.name || '').toLowerCase().includes(q);
      // Select values are always strings; product ids are numbers - compare as strings.
      const matchesCat = filterCatId ? String(p.categoryId) === String(filterCatId) : true;
      const matchesStation = filterStationId ? String(p.stationId) === String(filterStationId) : true;
      const matchesAvailable =
        filterAvailable === 'ALL' ? true :
        filterAvailable === 'AVAILABLE' ? p.available :
        !p.available;
      const matchesActive =
        filterActive === 'ALL' ? true :
        filterActive === 'ACTIVE' ? p.active :
        !p.active;
      return matchesSearch && matchesCat && matchesStation && matchesAvailable && matchesActive;
    });

    const sorted = [...result].sort((a, b) => {
      switch (sortBy) {
        case 'NAME_DESC':
          return (b.name || '').localeCompare(a.name || '', 'ar');
        case 'PRICE_ASC':
          return (a.price || 0) - (b.price || 0);
        case 'PRICE_DESC':
          return (b.price || 0) - (a.price || 0);
        case 'CATEGORY':
          return (a.categoryNameAr || '').localeCompare(b.categoryNameAr || '', 'ar');
        case 'NAME_ASC':
        default:
          return (a.name || '').localeCompare(b.name || '', 'ar');
      }
    });

    return sorted;
  }, [products, search, filterCatId, filterStationId, filterAvailable, filterActive, sortBy]);

  async function handleOpenModal(product = null) {
    if (product) {
      setEditingProduct(product);
      setForm({
        name: product.name,
        price: product.price,
        categoryId: product.categoryId,
        stationId: product.stationId || (stations.length > 0 ? stations[0].id : ''),
        revenueLine: product.revenueLine || 'BUFFET',
        available: product.available,
      });
      loadProductOptions(product.id);
      
      // Load Recipes
      setRecipesLoading(true);
      try {
        const recipes = await auditApi.getProductRecipes(product.id);
        setProductRecipes(recipes || []);
      } catch (err) {
        console.error('Failed to load recipes', err);
        setProductRecipes([]);
      } finally {
        setRecipesLoading(false);
      }
    } else {
      setEditingProduct(null);
      setForm({
        name: '',
        price: '',
        categoryId: categories.length > 0 ? categories[0].id : '',
        stationId: stations.length > 0 ? stations[0].id : '',
        revenueLine: 'BUFFET',
        available: true,
      });
      setProductOptions([]);
      setProductRecipes([]);
    }
    setNewOptionForm({ nameAr: '', priceDelta: '0', isDefault: false });
    setNewRecipeForm({ auditItemId: '', deductionQuantity: '' });
    setIsModalOpen(true);
  }

  async function handleSave(e) {
    e.preventDefault();
    if (!form.name.trim() || !form.price || !form.categoryId) {
      toast.warning('Please fill in all required fields.');
      return;
    }

    setIsSaving(true);
    const payload = {
      ...form,
      price: parseFloat(form.price),
      stationId: parseInt(form.stationId),
    };

    try {
      let productId;
      if (editingProduct) {
        await menuApi.updateProduct(editingProduct.id, payload);
        productId = editingProduct.id;
        toast.success('تم تعديل المنتج بنجاح');
      } else {
        const createdProduct = await menuApi.createProduct(payload);
        productId = createdProduct.id;
        if (productOptions.length > 0) {
          for (const opt of productOptions) {
            await menuApi.createOption(createdProduct.id, {
              nameAr: opt.nameAr,
              priceDelta: opt.priceDelta,
              isDefault: opt.isDefault
            });
          }
        }
        toast.success('تم إنشاء المنتج بنجاح مع اختياراته');
      }

      // Save Recipes
      const recipeDtos = productRecipes.map(r => ({
        productId: productId,
        auditItemId: r.auditItemId,
        deductionQuantity: parseFloat(r.deductionQuantity)
      }));
      await auditApi.saveProductRecipes(productId, recipeDtos);

      setIsModalOpen(false);
      await loadData();
    } catch (err) {
      toast.error(err.message, 'فشل حفظ المنتج أو المكونات');
    } finally {
      setIsSaving(false);
    }
  }

  async function toggleAvailability(product) {
    try {
      await menuApi.setAvailability(product.id, !product.available);
      toast.info(`${product.name} is now ${!product.available ? 'available' : 'unavailable'}`);
      await loadData();
    } catch (err) {
      toast.error(err.message, 'Failed to update availability');
    }
  }

  async function handleDeactivate(product) {
    if (role !== ROLES.SUPERVISOR) return;
    try {
      if (product.active) {
        await menuApi.deactivateProduct(product.id);
      } else {
        await menuApi.activateProduct(product.id);
      }
      toast.success('Product status updated');
      await loadData();
    } catch (err) {
      toast.error(err.message, 'Failed to update status');
    }
  }

  return (
    <div className="page">
      <ObserverBanner />
      <div className="page__header">
        <div>
          <h1 className="page__title">المنتجات</h1>
          <p className="page__subtitle">إدارة المنتجات والأسعار والتوافر</p>
        </div>
        <div className="page__actions">
          {role === ROLES.SUPERVISOR && (
            <Button rightIcon={<Plus size={16} />} onClick={() => handleOpenModal()}>
              إضافة منتج
            </Button>
          )}
        </div>
      </div>

      <div className="page-filters">
        <Input
          placeholder="دور على منتج..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          rightIcon={<Search size={16} />}
          className="page-filters__search"
        />
        <div className="field-select">
          <select
            className="field-select__control"
            value={filterCatId}
            onChange={(e) => setFilterCatId(e.target.value)}
          >
            <option value="">كل الأقسام</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
        <div className="field-select">
          <select
            className="field-select__control"
            value={filterStationId}
            onChange={(e) => setFilterStationId(e.target.value)}
          >
            <option value="">كل أماكن التجهيز</option>
            {stations.map((s) => (
              <option key={s.id} value={s.id}>{s.nameAr}</option>
            ))}
          </select>
        </div>
        <div className="field-select">
          <select
            className="field-select__control"
            value={filterAvailable}
            onChange={(e) => setFilterAvailable(e.target.value)}
          >
            <option value="ALL">كل حالات التوافر</option>
            <option value="AVAILABLE">متاح فقط</option>
            <option value="UNAVAILABLE">غير متاح فقط</option>
          </select>
        </div>
        <div className="field-select">
          <select
            className="field-select__control"
            value={filterActive}
            onChange={(e) => setFilterActive(e.target.value)}
          >
            <option value="ALL">كل الحالات</option>
            <option value="ACTIVE">نشط فقط</option>
            <option value="INACTIVE">غير نشط فقط</option>
          </select>
        </div>
        <div className="field-select">
          <select
            className="field-select__control"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            title="الترتيب"
          >
            <option value="NAME_ASC">الاسم (أ-ي)</option>
            <option value="NAME_DESC">الاسم (ي-أ)</option>
            <option value="PRICE_ASC">السعر (الأقل أولاً)</option>
            <option value="PRICE_DESC">السعر (الأعلى أولاً)</option>
            <option value="CATEGORY">القسم</option>
          </select>
        </div>
      </div>

      <div className="data-table-wrap">
        {loading ? (
          <div className="data-table-empty"><Spinner /></div>
        ) : filteredProducts.length === 0 ? (
          <div className="data-table-empty">مفيش منتجات مطابقة لخيارات البحث والفلترة.</div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>الاسم</th>
                <th>القسم</th>
                <th>السعر</th>
                <th>مكان التجهيز</th>
                <th>متاح</th>
                <th>الحالة</th>
                {role === ROLES.SUPERVISOR && <th style={{ textAlign: 'left' }}>تحكم</th>}
              </tr>
            </thead>
            <tbody>
              {filteredProducts.map((prod) => {
                const cat = categories.find((c) => c.id === prod.categoryId);
                return (
                  <tr key={prod.id}>
                    <td style={{ fontWeight: 500 }}>{prod.name}</td>
                    <td>{cat?.name || 'غير معروف'}</td>
                    <td className="data-table__number">{formatCurrency(prod.price)}</td>
                    <td>
                      <Badge variant="neutral">{stationNames[prod.stationCode] || prod.stationCode}</Badge>
                    </td>
                    <td>
                      <label className="toggle">
                        <input
                          type="checkbox"
                          checked={prod.available}
                          onChange={() => toggleAvailability(prod)}
                          style={{ display: 'none' }}
                        />
                        <div className={`toggle__track ${prod.available ? 'toggle__track--on' : ''}`}>
                          <div className="toggle__thumb" />
                        </div>
                      </label>
                    </td>
                    <td>
                      <Badge variant={prod.active ? 'success' : 'danger'}>
                        {prod.active ? 'نشط' : 'غير نشط'}
                      </Badge>
                    </td>
                    {role === ROLES.SUPERVISOR && (
                      <td>
                        <div className="data-table__actions" style={{ justifyContent: 'flex-end', gap: '4px' }}>
                          <Button variant="ghost" size="sm" onClick={() => handleOpenModal(prod)} title="تعديل المنتج والاختيارات">
                            <Edit2 size={15} />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeactivate(prod)}
                            style={{ color: prod.active ? 'var(--danger)' : 'var(--success)' }}
                          >
                            {prod.active ? 'تعطيل' : 'تفعيل'}
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

      {role === ROLES.SUPERVISOR && (
        <Modal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          title={editingProduct ? 'تعديل بيانات المنتج' : 'إضافة منتج جديد'}
          icon={editingProduct ? '✏️' : '✨'}
          subtitle={editingProduct ? `تعديل الصنف: ${editingProduct.name} — تحديد السعر والقسم ومكان التجهيز` : 'إضافة صنف جديد لقائمة المنيو وتعيين السعر وقسم التجهيز'}
          size="lg"
        >
          <form onSubmit={handleSave} className="form-grid">
            <Input
              label="اسم المنتج"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
              autoFocus
            />
            
            <div className="form-grid--2">
              <Input
                label="السعر (جنيه)"
                type="number"
                step="0.01"
                min="0"
                value={form.price}
                onChange={(e) => setForm({ ...form, price: e.target.value })}
                required
              />
              
              <div className="field-select">
                <label className="field-select__label">القسم</label>
                <select
                  className="field-select__control"
                  value={form.categoryId}
                  onChange={(e) => setForm({ ...form, categoryId: e.target.value })}
                  required
                >
                  <option value="" disabled>اختار القسم...</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="form-grid--2">
              <div className="field-select">
                <label className="field-select__label">مكان التجهيز</label>
                <select
                  className="field-select__control"
                  value={form.stationId}
                  onChange={(e) => setForm({ ...form, stationId: e.target.value })}
                  required
                >
                  <option value="" disabled>اختار مكان التجهيز...</option>
                  {stations.map((s) => (
                    <option key={s.id} value={s.id}>{s.nameAr}</option>
                  ))}
                </select>
              </div>
              
              <div className="field-select">
                <label className="field-select__label">نوع الإيراد (القسم المالي)</label>
                <select
                  className="field-select__control"
                  value={form.revenueLine}
                  onChange={(e) => setForm({ ...form, revenueLine: e.target.value })}
                >
                  <option value="BUFFET">مشروبات (الكافيه / البوفيه)</option>
                  <option value="FOOD">مأكولات (المطعم / المطبخ)</option>
                </select>
              </div>
            </div>

            <div style={{ marginTop: 'var(--space-2)' }}>
              <label className="toggle">
                <input
                  type="checkbox"
                  checked={form.available}
                  onChange={(e) => setForm({ ...form, available: e.target.checked })}
                  style={{ display: 'none' }}
                />
                <div className={`toggle__track ${form.available ? 'toggle__track--on' : ''}`}>
                  <div className="toggle__thumb" />
                </div>
                <span style={{ fontSize: 'var(--text-sm)', marginRight: '8px' }}>متاح للبيع</span>
              </label>
            </div>

            {/* Options Management Section (Integrated) */}
            <div style={{ gridColumn: '1/-1', marginTop: '24px', paddingTop: '20px', borderTop: '1px solid var(--border-color)' }}>
              <h3 style={{ fontSize: 'var(--text-md)', marginBottom: '12px', fontWeight: 600 }}>الاختيارات المتاحة للمنتج (الأحجام والإضافات مثل: كبير، وسط، شيكولاتة زيادة)</h3>
              
              {/* Add new option inline */}
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr auto auto', gap: '12px', alignItems: 'flex-end', background: 'var(--bg-surface-hover)', padding: '16px', borderRadius: '8px', marginBottom: '16px' }}>
                <Input
                  label="اسم الاختيار"
                  placeholder="مثال: كبير"
                  value={newOptionForm.nameAr}
                  onChange={(e) => setNewOptionForm({ ...newOptionForm, nameAr: e.target.value })}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddOption(e);
                    }
                  }}
                />
                <Input
                  label="فارق السعر (+/-)"
                  type="number"
                  step="0.1"
                  value={newOptionForm.priceDelta}
                  onChange={(e) => setNewOptionForm({ ...newOptionForm, priceDelta: e.target.value })}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddOption(e);
                    }
                  }}
                />
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', justifyContent: 'center', height: '100%', paddingBottom: '6px' }}>
                  <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', userSelect: 'none' }}>افتراضي</span>
                  <label className="toggle">
                    <input
                      type="checkbox"
                      checked={newOptionForm.isDefault}
                      onChange={(e) => setNewOptionForm({ ...newOptionForm, isDefault: e.target.checked })}
                      style={{ display: 'none' }}
                    />
                    <div className={`toggle__track ${newOptionForm.isDefault ? 'toggle__track--on' : ''}`}>
                      <div className="toggle__thumb" />
                    </div>
                  </label>
                </div>
                <Button type="button" onClick={handleAddOption} style={{ height: '40px', padding: '0 16px' }}>+ إضافة</Button>
              </div>

              {/* Table of existing options */}
              <div className="data-table-wrap" style={{ maxHeight: '180px', overflowY: 'auto' }}>
                {optionsLoading ? (
                  <div className="data-table-empty"><Spinner /></div>
                ) : productOptions.length === 0 ? (
                  <div className="data-table-empty" style={{ padding: '16px 0' }}>مفيش أي اختيارات مضافة للمنتج ده لسه.</div>
                ) : (
                  <table className="data-table" style={{ fontSize: 'var(--text-sm)' }}>
                    <thead>
                      <tr>
                        <th>الاسم</th>
                        <th>فارق السعر</th>
                        <th>الافتراضي</th>
                        <th style={{ textAlign: 'left' }}>إزالة</th>
                      </tr>
                    </thead>
                    <tbody>
                      {productOptions.map((opt) => (
                        <tr key={opt.id}>
                          <td style={{ fontWeight: 500 }}>{opt.nameAr}</td>
                          <td>{opt.priceDelta > 0 ? `+${formatCurrency(opt.priceDelta)}` : opt.priceDelta < 0 ? `-${formatCurrency(Math.abs(opt.priceDelta))}` : '0.00 ج.م'}</td>
                          <td>
                            {opt.isDefault ? (
                              <Badge variant="success">افتراضي</Badge>
                            ) : (
                              <span style={{ color: 'var(--text-muted)' }}>-</span>
                            )}
                          </td>
                          <td>
                            <div className="data-table__actions" style={{ justifyContent: 'flex-end' }}>
                              <Button
                                variant="ghost"
                                size="sm"
                                type="button"
                                onClick={() => handleDeleteOption(opt.id)}
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
            </div>

            {/* Recipes / Ingredients Section */}
            <div style={{ gridColumn: '1/-1', marginTop: '24px', paddingTop: '20px', borderTop: '1px solid var(--border-color)' }}>
              <h3 style={{ fontSize: 'var(--text-md)', marginBottom: '12px', fontWeight: 600 }}>مكونات ومقادير الصنف للجرد التلقائي (الخامات المستهلكة عند البيع)</h3>

              {/* Add new recipe item inline */}
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr auto', gap: '12px', alignItems: 'flex-end', background: 'var(--bg-surface-hover)', padding: '16px', borderRadius: '8px', marginBottom: '16px' }}>
                <div className="field-select" style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label className="field-select__label">الخامة / المكون</label>
                  <select
                    className="field-select__control"
                    value={newRecipeForm.auditItemId}
                    onChange={(e) => setNewRecipeForm({ ...newRecipeForm, auditItemId: e.target.value })}
                  >
                    <option value="" disabled>-- اختر الخامة --</option>
                    {auditItems.map(item => (
                      <option key={item.id} value={item.id}>{item.name} ({item.unit})</option>
                    ))}
                  </select>
                </div>
                <Input
                  label="الكمية المستهلكة"
                  placeholder="مثال: 15"
                  type="number"
                  step="0.001"
                  min="0.001"
                  value={newRecipeForm.deductionQuantity}
                  onChange={(e) => setNewRecipeForm({ ...newRecipeForm, deductionQuantity: e.target.value })}
                />
                <Button type="button" onClick={handleAddRecipeItem} style={{ height: '40px', padding: '0 16px' }}>+ إضافة</Button>
              </div>

              {/* Table of existing recipe components */}
              <div className="data-table-wrap" style={{ maxHeight: '180px', overflowY: 'auto' }}>
                {recipesLoading ? (
                  <div className="data-table-empty"><Spinner /></div>
                ) : productRecipes.length === 0 ? (
                  <div className="data-table-empty" style={{ padding: '16px 0' }}>مفيش خامات أو مكونات مربوطة بالصنف ده. (البيع لن يخصم من الخامات تلقائياً)</div>
                ) : (
                  <table className="data-table" style={{ fontSize: 'var(--text-sm)' }}>
                    <thead>
                      <tr>
                        <th>الخامة</th>
                        <th>الكمية المستهلكة لكل أوردر</th>
                        <th>الوحدة</th>
                        <th style={{ textAlign: 'left' }}>إزالة</th>
                      </tr>
                    </thead>
                    <tbody>
                      {productRecipes.map((recipe) => (
                        <tr key={recipe.auditItemId}>
                          <td style={{ fontWeight: 500 }}>{recipe.auditItemName || auditItems.find(i => String(i.id) === String(recipe.auditItemId))?.name || 'خامة'}</td>
                          <td>{recipe.deductionQuantity}</td>
                          <td>{recipe.auditItemUnit || auditItems.find(i => String(i.id) === String(recipe.auditItemId))?.unit || ''}</td>
                          <td>
                            <div className="data-table__actions" style={{ justifyContent: 'flex-end' }}>
                              <Button
                                variant="ghost"
                                size="sm"
                                type="button"
                                onClick={() => handleDeleteRecipeItem(recipe.auditItemId)}
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
            </div>

            <div className="form-actions" style={{ gridColumn: '1/-1', display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '16px' }}>
              <Button variant="secondary" onClick={() => setIsModalOpen(false)} type="button">إلغاء</Button>
              <Button type="submit" loading={isSaving}>حفظ المنتج</Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
