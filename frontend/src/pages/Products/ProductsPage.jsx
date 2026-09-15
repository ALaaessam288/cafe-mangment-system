import { useCallback, useEffect, useState, useMemo } from 'react';
import { 
  Plus, Edit2, Search, Trash2,
  LayoutGrid, Table as TableIcon, Package, CheckCircle2, XCircle
} from 'lucide-react';
import { menuApi } from '../../api/menuApi';
import { quotaReached, quotaText, hasStatedLimit } from '../../api/plansApi';
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
import QuotaExceededModal from '../../components/QuotaExceededModal/QuotaExceededModal';
import { ROLES } from '../../utils/constants';
import { sounds } from '../../utils/soundEffects';
import './ProductsPage.css';

const stationNames = {
  'KITCHEN': 'المطبخ',
  'BAR': 'البار',
  'OTHER': 'أخرى'
};


/* Ready-made option sets.
 *
 * Every one of these is a question with one answer — a drink has one size and one sugar level —
 * which is why they carry a group. Single-select applies inside a group and not across them, so a
 * latte can be large AND مظبوط; before the group existed the modifier dialog had to allow exactly
 * one selection for the whole product and that combination could not be expressed at all.
 *
 * Price deltas start at zero deliberately. What a large costs over a medium differs per café and
 * per drink, and a number invented here would be wrong everywhere; the owner edits them after.
 */
const OPTION_PRESETS = [
  {
    key: 'DRINK_SIZE',
    label: 'أحجام المشروبات',
    group: 'SIZE',
    options: ['صغير', 'وسط', 'كبير', 'كبير جداً'],
    defaultIndex: 1,
  },
  {
    key: 'FOOD_SIZE',
    label: 'أحجام المأكولات',
    group: 'SIZE',
    options: ['صغير', 'وسط', 'كبير', 'سنجل', 'دوبل', 'تريبل'],
    defaultIndex: 1,
  },
  {
    key: 'SUGAR',
    label: 'مستوى السكر',
    group: 'SUGAR',
    options: ['سادة', 'ع الريحة', 'مظبوط', 'مانو', 'زيادة', 'فوق الزيادة'],
    defaultIndex: 2,
  },
  {
    key: 'SPICE',
    label: 'درجة الحرارة/التتبيلة',
    group: 'SPICE',
    options: ['عادي', 'سبايسي', 'اكسترا سبايسي'],
    defaultIndex: 0,
  },
];

export default function ProductsPage() {
  const toast = useToast();
  const { role, user: currentUser } = useAuth();
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [stations, setStations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState('GRID'); // 'GRID' | 'TABLE'
  const [quotaModal, setQuotaModal] = useState({ open: false, message: '' });

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
  const [newOptionForm, setNewOptionForm] = useState({ nameAr: '', priceDelta: '0', isDefault: false, optionGroup: 'ADDON' });
  const [applyingPreset, setApplyingPreset] = useState(null);
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
      isDefault: newOptionForm.isDefault,
      optionGroup: newOptionForm.optionGroup || 'ADDON'
    };

    if (editingProduct) {
      setIsSavingOption(true);
      try {
        await menuApi.createOption(editingProduct.id, optionPayload);
        toast.success('تمت إضافة الاختيار بنجاح');
        setNewOptionForm({ nameAr: '', priceDelta: '0', isDefault: false, optionGroup: newOptionForm.optionGroup });
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
      setNewOptionForm({ nameAr: '', priceDelta: '0', isDefault: false, optionGroup: newOptionForm.optionGroup });
      toast.success('تمت إضافة الاختيار لقائمة الحفظ');
    }
  }

  /**
   * Adds a whole preset in one click.
   *
   * Existing names in the same group are skipped rather than duplicated, so pressing the button
   * twice — or adding "كبير" by hand first — cannot leave the cashier choosing between two
   * identical chips.
   */
  async function handleApplyPreset(preset) {
    const existing = new Set(
      productOptions
        .filter((o) => (o.optionGroup || 'ADDON') === preset.group)
        .map((o) => (o.nameAr || '').trim())
    );
    const toAdd = preset.options.filter((name) => !existing.has(name));

    if (toAdd.length === 0) {
      toast.info('كل اختيارات المجموعة دي مضافة بالفعل');
      return;
    }

    const rows = toAdd.map((name) => ({
      nameAr: name,
      priceDelta: 0,
      // Only mark a default when the group does not already have one.
      isDefault: existing.size === 0 && preset.options[preset.defaultIndex] === name,
      optionGroup: preset.group,
    }));

    if (!editingProduct) {
      // New product: the options are held locally and saved with it.
      setProductOptions((prev) => [...prev, ...rows.map((r) => ({ id: Date.now() + Math.random(), ...r }))]);
      toast.success(`تمت إضافة ${rows.length} اختيار لقائمة الحفظ`);
      return;
    }

    setApplyingPreset(preset.key);
    try {
      // Sequentially, not Promise.all: the server assigns display order by insertion, and a
      // parallel burst would scramble سادة/مظبوط/زيادة into an arbitrary sequence on the till.
      for (const row of rows) {
        await menuApi.createOption(editingProduct.id, row);
      }
      await loadProductOptions(editingProduct.id);
      toast.success(`تمت إضافة ${rows.length} اختيار`);
    } catch (err) {
      toast.error(err.message, 'فشل إضافة المجموعة');
      await loadProductOptions(editingProduct.id);
    } finally {
      setApplyingPreset(null);
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
      if (quotaReached(products.length, currentUser?.maxProducts)) {
        setQuotaModal({
          open: true,
          message: `لقد بلغت الحد الأقصى للأصناف والمنتجات المسموحة في باقتك (${quotaText(products.length, currentUser?.maxProducts)} صنف). يرجى ترقية الباقة لإضافة منيو وأصناف جديدة.`
        });
        return;
      }
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
    setNewOptionForm({ nameAr: '', priceDelta: '0', isDefault: false, optionGroup: newOptionForm.optionGroup });
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
      if (err.status === 403 || err.message?.includes('وصلت للحد الأقصى') || err.message?.includes('Quota exceeded') || err.data?.error === 'QUOTA_EXCEEDED') {
        setIsModalOpen(false);
        setQuotaModal({ open: true, message: err.message });
      } else {
        toast.error(err.message, 'فشل حفظ المنتج أو المكونات');
      }
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

  /* Delete asks first, and it says what it is about to destroy.
     A menu item carries options and a recipe with it, and there is no undo - so the confirmation
     names the product rather than asking the generic "are you sure?" that everyone clicks through.
     Deactivate stays the right answer for a product that has ever been sold; the server refuses
     the delete in that case and says so, and this dialog offers that as the way out. */
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  async function handleConfirmDelete() {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      await menuApi.deleteProduct(deleteTarget.id);
      toast.success(`اتمسح "${deleteTarget.name}" خالص`);
      setDeleteTarget(null);
      await loadData();
    } catch (err) {
      toast.error(err.message, 'فشل مسح الصنف');
    } finally {
      setIsDeleting(false);
    }
  }

  async function handleDeactivateFromDialog() {
    const product = deleteTarget;
    setDeleteTarget(null);
    if (product?.active) await handleDeactivate(product);
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

  const stats = useMemo(() => {
    const total = products.length;
    const availableCount = products.filter(p => p.available && p.active).length;
    const barCount = products.filter(p => p.stationCode === 'BAR').length;
    const kitchenCount = products.filter(p => p.stationCode === 'KITCHEN').length;
    const unavailableCount = products.filter(p => !p.available || !p.active).length;
    const uncategorizedCount = products.filter(p => !p.categoryId).length;
    const averagePrice = total > 0 ? products.reduce((sum, p) => sum + Number(p.price || 0), 0) / total : 0;
    const menuHealth = total > 0 ? Math.round((availableCount / total) * 100) : 100;
    return { total, availableCount, barCount, kitchenCount, unavailableCount, uncategorizedCount, averagePrice, menuHealth };
  }, [products]);

  return (
    <div className="page products-creative">
      <ObserverBanner />

      {/* ── Creative Header ── */}
      <div className="page__header products-header">
        <div className="products-header__info">
          <div className="products-header__icon-box">
            <Package size={24} className="text-accent" />
          </div>
          <div>
            <div className="products-header__title-row">
              <h1 className="page__title">قائمة المنتجات والمنيو</h1>
              <span className="products-count-badge">{filteredProducts.length} صنف</span>
            </div>
            <p className="page__subtitle">إدارة الأصناف، الأسعار، التوافر ومحطات التجهيز</p>
          </div>
        </div>

        <div className="page__actions products-header__actions">
          {/* Dual View Toggle */}
          <div className="products-view-toggle">
            <button
              type="button"
              className={`view-mode-btn ${viewMode === 'GRID' ? 'view-mode-btn--active' : ''}`}
              onClick={() => { sounds.playTap(); setViewMode('GRID'); }}
            >
              <LayoutGrid size={15} />
              <span>كروت (3D)</span>
            </button>
            <button
              type="button"
              className={`view-mode-btn ${viewMode === 'TABLE' ? 'view-mode-btn--active' : ''}`}
              onClick={() => { sounds.playTap(); setViewMode('TABLE'); }}
            >
              <TableIcon size={15} />
              <span>جدول منظم</span>
            </button>
          </div>

          {hasStatedLimit(currentUser?.maxProducts) && (
            <div className="tables-quota-pill">
              <span>السعة:</span>
              <strong className="font-mono">{quotaText(products.length, currentUser?.maxProducts)}</strong>
            </div>
          )}

          {role === ROLES.SUPERVISOR && (
            <Button rightIcon={<Plus size={16} />} onClick={() => handleOpenModal()} variant="primary">
              إضافة منتج جديد
            </Button>
          )}
        </div>
      </div>

      {/* ── Menu health command strip ── */}
      <section className="menu-health-panel">
        <div className="menu-health-panel__score" style={{ '--menu-health': `${stats.menuHealth * 3.6}deg` }}>
          <div><strong>{stats.menuHealth}%</strong><span>جاهزية المنيو</span></div>
        </div>
        <div className="menu-health-panel__copy">
          <span className="menu-health-panel__eyebrow">MENU HEALTH</span>
          <h2>{stats.unavailableCount === 0 ? 'المنيو جاهز بالكامل للطلب' : `${stats.unavailableCount} أصناف تحتاج مراجعة`}</h2>
          <p>صورة سريعة لجاهزية الأصناف، جودة التصنيف، وتوازن التشغيل بين البار والمطبخ.</p>
        </div>
        <div className="menu-health-panel__signals">
          <button type="button" onClick={() => setFilterAvailable('UNAVAILABLE')} className={stats.unavailableCount ? 'has-warning' : ''}>
            <span>غير متاح</span><strong>{stats.unavailableCount}</strong><small>اضغط للمراجعة</small>
          </button>
          <button type="button" onClick={() => setFilterCatId('')} className={stats.uncategorizedCount ? 'has-warning' : ''}>
            <span>بدون تصنيف</span><strong>{stats.uncategorizedCount}</strong><small>يؤثر على رحلة الطلب</small>
          </button>
          <div><span>متوسط السعر</span><strong>{formatCurrency(stats.averagePrice)}</strong><small>عبر كل المنيو</small></div>
        </div>
      </section>

      {/* ── KPI Summary Strip ── */}
      <div className="products-kpi-strip">
        <div className="product-kpi-item">
          <span className="product-kpi-item__label">إجمالي المنيو</span>
          <strong className="product-kpi-item__val">{stats.total} صنف</strong>
        </div>
        <div className="product-kpi-item">
          <span className="product-kpi-item__label">متاح للطلب الآن</span>
          <strong className="product-kpi-item__val text-emerald">{stats.availableCount} متاح</strong>
        </div>
        <div className="product-kpi-item">
          <span className="product-kpi-item__label">مشروبات وبوفيه</span>
          <strong className="product-kpi-item__val text-accent font-mono">{stats.barCount} صنف</strong>
        </div>
        <div className="product-kpi-item">
          <span className="product-kpi-item__label">مأكولات ومطبخ</span>
          <strong className="product-kpi-item__val text-cyan font-mono">{stats.kitchenCount} صنف</strong>
        </div>
      </div>

      {/* ── Category Pill Bar & Search Strip ── */}
      <div className="products-filter-strip">
        <div className="products-cat-pills">
          <button
            type="button"
            className={`cat-pill ${filterCatId === '' ? 'cat-pill--active' : ''}`}
            onClick={() => { sounds.playTap(); setFilterCatId(''); }}
          >
            <span>كل الأقسام</span>
            <span className="cat-pill__count">{products.length}</span>
          </button>
          {categories.map((c) => (
            <button
              key={c.id}
              type="button"
              className={`cat-pill ${filterCatId === String(c.id) || filterCatId === c.id ? 'cat-pill--active' : ''}`}
              onClick={() => { sounds.playTap(); setFilterCatId(c.id); }}
            >
              <span>{c.name}</span>
              <span className="cat-pill__count">{products.filter(p => p.categoryId === c.id).length}</span>
            </button>
          ))}
        </div>

        <div className="products-controls-row">
          <div className="products-search-box">
            <Search size={14} className="products-search-icon" />
            <input
              type="text"
              className="products-search-input"
              placeholder="بحث بالاسم، الباركود، أو السعر..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search && (
              <button type="button" className="products-search-clear" onClick={() => setSearch('')}>✕</button>
            )}
          </div>

          <div className="products-filters-group">
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
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
              >
                <option value="NAME_ASC">الاسم (أ-ي)</option>
                <option value="NAME_DESC">الاسم (ي-أ)</option>
                <option value="PRICE_ASC">السعر (الأقل أولاً)</option>
                <option value="PRICE_DESC">السعر (الأعلى أولاً)</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* ── Content Stream ── */}
      {loading ? (
        <div className="page page-center"><Spinner /></div>
      ) : filteredProducts.length === 0 ? (
        <div className="tables-empty-state">
          <Package size={48} className="tables-empty-icon" />
          <h3>لا توجد أصناف مطابقة</h3>
          <p>أضف أصناف جديدة للمنيو أو عدل خيارات البحث</p>
          {role === ROLES.SUPERVISOR && (
            <Button variant="primary" rightIcon={<Plus size={16} />} onClick={() => handleOpenModal()}>
              إضافة صنف جديد
            </Button>
          )}
        </div>
      ) : viewMode === 'GRID' ? (
        /* ═════ 3D Product Cards Grid ═════ */
        <div className="products-cards-grid">
          {filteredProducts.map((prod) => {
            const cat = categories.find((c) => c.id === prod.categoryId);
            const isBar = prod.stationCode === 'BAR';
            return (
              <article
                key={prod.id} 
                className={`product-3d-card ${prod.active ? '' : 'product-3d-card--disabled'}`}
              >
                <div className={`product-3d-card__status-rail ${prod.available && prod.active ? 'is-ready' : 'is-offline'}`} />
                <div>
                  <div className="product-3d-card__head">
                    <span className="product-category-chip">{cat?.name || 'قسم عام'}</span>
                    <span className={`product-station-badge ${isBar ? 'product-station-badge--bar' : 'product-station-badge--kitchen'}`}>
                      {isBar ? '☕ بار' : '🍳 مطبخ'}
                    </span>
                  </div>

                  <h3 className="product-3d-card__title">{prod.name}</h3>

                  <div className="product-3d-card__price-row">
                    <strong className="product-price-val font-mono">{formatCurrency(prod.price)}</strong>
                    <Badge variant={prod.active ? 'success' : 'danger'}>
                      {prod.active ? 'نشط' : 'معطل'}
                    </Badge>
                  </div>
                </div>

                <div className="product-3d-card__footer">
                  <label className="product-avail-switch" title="تبديل التوافر الفوري للطلب">
                    <input
                      type="checkbox"
                      checked={prod.available}
                      onChange={() => toggleAvailability(prod)}
                      style={{ display: 'none' }}
                    />
                    <div className={`toggle__track ${prod.available ? 'toggle__track--on' : ''}`}>
                      <div className="toggle__thumb" />
                    </div>
                    <span className="text-xs text-muted">{prod.available ? 'متاح' : 'نافد'}</span>
                  </label>

                  {role === ROLES.SUPERVISOR && (
                    <div className="product-3d-card__actions">
                      <button
                        type="button"
                        className="product-action-btn product-action-btn--edit"
                        onClick={() => handleOpenModal(prod)}
                        title="تعديل المنتج والوصفة"
                      >
                        <Edit2 size={13} />
                      </button>
                      <button
                        type="button"
                        className="product-action-btn"
                        onClick={() => handleDeactivate(prod)}
                        title={prod.active ? 'تعطيل الصنف' : 'تفعيل الصنف'}
                        style={{ color: prod.active ? 'var(--danger)' : 'var(--success)' }}
                      >
                        {prod.active ? <XCircle size={13} /> : <CheckCircle2 size={13} />}
                      </button>
                      <button
                        type="button"
                        className="product-action-btn"
                        onClick={() => setDeleteTarget(prod)}
                        title="مسح الصنف نهائياً"
                        style={{ color: 'var(--danger)' }}
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        /* ═════ Data Table View ═════ */
        <div className="data-table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>الاسم</th>
                <th>القسم</th>
                <th>السعر</th>
                <th>مكان التجهيز</th>
                <th>متاح للطلب</th>
                <th>الحالة</th>
                {(role === ROLES.SUPERVISOR || role === ROLES.ADMIN) && <th style={{ textAlign: 'left' }}>تحكم</th>}
              </tr>
            </thead>
            <tbody>
              {filteredProducts.map((prod) => {
                const cat = categories.find((c) => c.id === prod.categoryId);
                return (
                  <tr key={prod.id}>
                    <td style={{ fontWeight: 700, color: '#fff' }}>{prod.name}</td>
                    <td><span className="table-zone-chip">{cat?.name || 'غير معروف'}</span></td>
                    <td className="data-table__number font-mono fw-bold text-accent">{formatCurrency(prod.price)}</td>
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
                        <div className="data-table__actions" style={{ justifyContent: 'flex-end', gap: '6px' }}>
                          <Button variant="ghost" size="sm" onClick={() => handleOpenModal(prod)} title="تعديل المنتج والاختيارات">
                            <Edit2 size={14} />
                            <span>تعديل</span>
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeactivate(prod)}
                            style={{ color: prod.active ? 'var(--danger)' : 'var(--success)' }}
                          >
                            {prod.active ? 'تعطيل' : 'تفعيل'}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setDeleteTarget(prod)}
                            style={{ color: 'var(--danger)' }}
                            title="مسح الصنف نهائياً"
                          >
                            <Trash2 size={14} />
                            <span>مسح</span>
                          </Button>
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Quota Limit Reached Modal */}
      <QuotaExceededModal
        isOpen={quotaModal.open}
        onClose={() => setQuotaModal({ open: false, message: '' })}
        resourceName="الأصناف والمنتجات"
        currentCount={products.length}
        maxLimit={currentUser?.maxProducts}
        customMessage={quotaModal.message}
      />

      {/* Delete confirmation */}
      <Modal
        isOpen={deleteTarget !== null}
        onClose={() => (isDeleting ? null : setDeleteTarget(null))}
        title="مسح الصنف نهائياً"
        icon="🗑️"
        subtitle={deleteTarget ? deleteTarget.name : ''}
        size="sm"
        footer={
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
            <Button variant="secondary" type="button" onClick={() => setDeleteTarget(null)} disabled={isDeleting}>
              إلغاء
            </Button>
            {deleteTarget?.active && (
              <Button variant="secondary" type="button" onClick={handleDeactivateFromDialog} disabled={isDeleting}>
                عطّله بس
              </Button>
            )}
            <Button
              type="button"
              onClick={handleConfirmDelete}
              loading={isDeleting}
              style={{ background: 'var(--danger)', borderColor: 'var(--danger)' }}
            >
              امسح نهائياً
            </Button>
          </div>
        }
      >
        <p style={{ margin: 0, lineHeight: 1.8 }}>
          هيتمسح <strong>{deleteTarget?.name}</strong> ومعاه الاختيارات والوصفة وحركات المخزون بتاعته،
          ومفيش رجوع.
        </p>
        <p style={{ margin: '12px 0 0', color: 'var(--text-muted)', lineHeight: 1.8 }}>
          المبيعات القديمة مش هتتأثر — الفواتير والتقارير محتفظة بالاسم والسعر وقت البيع،
          فالأرقام هتفضل زي ما هي. اللي بيضيع بس هو سجل حركات المخزون للصنف ده.
          «عطّله بس» بتخفيه من الكاشير من غير ما تضيع أي حاجة.
        </p>
      </Modal>

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
              
              {/* One-click option sets */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '14px' }}>
                {OPTION_PRESETS.map((preset) => (
                  <Button
                    key={preset.key}
                    type="button"
                    variant="secondary"
                    size="sm"
                    disabled={applyingPreset !== null}
                    onClick={() => handleApplyPreset(preset)}
                  >
                    {applyingPreset === preset.key ? '...' : `+ ${preset.label}`}
                  </Button>
                ))}
              </div>

              {/* Add new option inline */}
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr auto auto', gap: '12px', alignItems: 'flex-end', background: 'var(--bg-surface-hover)', padding: '16px', borderRadius: '8px', marginBottom: '16px' }}>
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
                <label style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>المجموعة</span>
                  <select
                    className="input"
                    value={newOptionForm.optionGroup}
                    onChange={(e) => setNewOptionForm({ ...newOptionForm, optionGroup: e.target.value })}
                  >
                    <option value="ADDON">إضافة (اختيار متعدد)</option>
                    <option value="SIZE">الحجم</option>
                    <option value="SUGAR">السكر</option>
                    <option value="SPICE">التتبيلة</option>
                  </select>
                </label>
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
                        <th>المجموعة</th>
                        <th>فارق السعر</th>
                        <th>الافتراضي</th>
                        <th style={{ textAlign: 'left' }}>إزالة</th>
                      </tr>
                    </thead>
                    <tbody>
                      {productOptions.map((opt) => (
                        <tr key={opt.id}>
                          <td style={{ fontWeight: 500 }}>{opt.nameAr}</td>
                          <td style={{ color: 'var(--text-muted)' }}>
                            {{ SIZE: 'الحجم', SUGAR: 'السكر', SPICE: 'التتبيلة' }[opt.optionGroup] || 'إضافة'}
                          </td>
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
