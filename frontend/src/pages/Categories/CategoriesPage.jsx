import { useCallback, useEffect, useState } from 'react';
import { Plus, Edit2, Trash2, LayoutGrid, Eye, EyeOff, ArrowUpLeft, Layers3 } from 'lucide-react';
import { menuApi } from '../../api/menuApi';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';
import { ROLES } from '../../utils/constants';
import Button from '../../components/Button/Button';
import Modal from '../../components/Modal/Modal';
import Input from '../../components/Input/Input';
import Spinner from '../../components/Spinner/Spinner';
import ObserverBanner from '../../components/ObserverBanner/ObserverBanner';
import './CategoriesPage.css';

export default function CategoriesPage() {
  const toast = useToast();
  const { role } = useAuth();
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [form, setForm] = useState({ name: '', displayOrder: 0, active: true });
  const [isSaving, setIsSaving] = useState(false);

  const loadCategories = useCallback(async () => {
    setLoading(true);
    try {
      const data = await menuApi.getCategories();
      setCategories(data);
    } catch (err) {
      toast.error(err.message, 'Failed to load categories');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { loadCategories(); }, [loadCategories]);

  function handleOpenModal(category = null) {
    if (category) {
      setEditingCategory(category);
      setForm({
        name: category.name,
        displayOrder: category.displayOrder ?? 0,
        active: category.active,
      });
    } else {
      setEditingCategory(null);
      setForm({ name: '', displayOrder: 0, active: true });
    }
    setIsModalOpen(true);
  }

  async function handleSave(e) {
    e.preventDefault();
    if (!form.name.trim()) return;

    setIsSaving(true);
    try {
      if (editingCategory) {
        await menuApi.updateCategory(editingCategory.id, {
          name: form.name.trim(),
          displayOrder: parseInt(form.displayOrder, 10),
        });
        toast.success('Category updated successfully');
      } else {
        await menuApi.createCategory({
          name: form.name.trim(),
          displayOrder: parseInt(form.displayOrder, 10),
        });
        toast.success('Category created successfully');
      }
      setIsModalOpen(false);
      await loadCategories();
    } catch (err) {
      toast.error(err.message, 'Failed to save category');
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete(id) {
    if (!window.confirm('متأكد إنك عايز تمسح القسم ده؟')) return;
    try {
      await menuApi.deleteCategory(id);
      toast.success('Category deleted successfully');
      await loadCategories();
    } catch (err) {
      toast.error(err.message, 'Failed to delete category');
    }
  }

  return (
    <div className="page cats-page">
      <ObserverBanner />
      <div className="page__header categories-hero">
        <div className="categories-hero__identity">
          <span className="categories-hero__icon"><Layers3 size={22} /></span>
          <div>
            <span className="categories-hero__eyebrow">MENU ARCHITECTURE</span>
            <h1 className="page__title">هندسة أقسام المنيو</h1>
            <p className="page__subtitle">رتّب رحلة الاختيار كما يراها العميل والكاشير في نقطة البيع</p>
          </div>
        </div>
        <div className="page__actions">
          {role === ROLES.SUPERVISOR && (
            <Button rightIcon={<Plus size={16} />} onClick={() => handleOpenModal()}>
              إضافة قسم
            </Button>
          )}
        </div>
      </div>

      <section className="categories-story-strip">
        <div><span>إجمالي الأقسام</span><strong>{categories.length}</strong><small>في هيكل المنيو</small></div>
        <div><span>ظاهر في التشغيل</span><strong>{categories.filter(cat => cat.active).length}</strong><small>أقسام نشطة</small></div>
        <div><span>غير نشط</span><strong>{categories.filter(cat => !cat.active).length}</strong><small>يحتاج مراجعة</small></div>
        <p><LayoutGrid size={18} /><span><strong>الترتيب يصنع رحلة الطلب</strong><small>الأرقام الأقل تظهر أولاً في تبويبات الكاشير.</small></span></p>
      </section>

      <div className="categories-workspace">
        {loading ? (
          <div className="categories-empty"><Spinner /></div>
        ) : categories.length === 0 ? (
          <div className="categories-empty"><Layers3 size={38} /><h3>ابدأ بهيكل منيو واضح</h3><p>أضف أول قسم مثل المشروبات الساخنة أو الوجبات.</p></div>
        ) : (
          <div className="category-card-grid">
            {[...categories].sort((a, b) => a.displayOrder - b.displayOrder).map((cat, index) => (
              <article className={`category-editorial-card ${cat.active ? '' : 'is-inactive'}`} key={cat.id}>
                <div className="category-editorial-card__order"><span>POSITION</span><strong>{String(cat.displayOrder ?? index + 1).padStart(2, '0')}</strong></div>
                <div className="category-editorial-card__body">
                  <span className="category-editorial-card__sequence">القسم {index + 1} من {categories.length}</span>
                  <h2>{cat.name}</h2>
                  <span className={`category-editorial-card__status ${cat.active ? 'is-live' : ''}`}>{cat.active ? <Eye size={12} /> : <EyeOff size={12} />}{cat.active ? 'ظاهر في المنيو' : 'مخفي من المنيو'}</span>
                </div>
                {role === ROLES.SUPERVISOR && (
                  <div className="category-editorial-card__actions">
                    <button type="button" onClick={() => handleOpenModal(cat)}><Edit2 size={14} /> تعديل</button>
                    <button type="button" className="is-danger" onClick={() => handleDelete(cat.id)}><Trash2 size={14} /></button>
                  </div>
                )}
                <ArrowUpLeft size={17} className="category-editorial-card__arrow" />
              </article>
            ))}
          </div>
        )}
      </div>

      {role === ROLES.SUPERVISOR && (
        <Modal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          title={editingCategory ? 'تعديل قسم المنيو' : 'إضافة قسم جديد'}
          icon={editingCategory ? '✏️' : '🏷️'}
          subtitle={editingCategory ? `تعديل اسم وترتيب ظهور قسم: ${editingCategory.name}` : 'إضافة قسم تصنيف جديد للمنتجات وتحديد ترتيب العرض'}
          size="sm"
        >
          <form onSubmit={handleSave} className="form-grid">
            <Input
              label="اسم القسم"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="مثال: مشروبات ساخنة"
              required
              autoFocus
            />
            <Input
              label="ترتيب الظهور في الكاشير (رقم)"
              type="number"
              value={form.displayOrder}
              onChange={(e) => setForm({ ...form, displayOrder: e.target.value })}
              hint="الأرقام الأقل تظهر أولاً في قائمة التبويبات بالـ POS."
              required
            />
            <div className="form-actions">
              <Button variant="secondary" onClick={() => setIsModalOpen(false)} type="button">إلغاء</Button>
              <Button type="submit" loading={isSaving} variant="primary">حفظ القسم</Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
