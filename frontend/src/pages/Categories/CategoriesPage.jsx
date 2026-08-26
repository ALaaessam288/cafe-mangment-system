import { useCallback, useEffect, useState } from 'react';
import { Plus, Edit2, Trash2 } from 'lucide-react';
import { menuApi } from '../../api/menuApi';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';
import { ROLES } from '../../utils/constants';
import Button from '../../components/Button/Button';
import Badge from '../../components/Badge/Badge';
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
      <div className="page__header">
        <div>
          <h1 className="page__title">الأقسام</h1>
          <p className="page__subtitle">إدارة أقسام المنيو وترتيبها</p>
        </div>
        <div className="page__actions">
          {role === ROLES.SUPERVISOR && (
            <Button rightIcon={<Plus size={16} />} onClick={() => handleOpenModal()}>
              إضافة قسم
            </Button>
          )}
        </div>
      </div>

      <div className="data-table-wrap">
        {loading ? (
          <div className="data-table-empty"><Spinner /></div>
        ) : categories.length === 0 ? (
          <div className="data-table-empty">مفيش أقسام. ضيف قسم عشان تبدأ.</div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>الاسم</th>
                <th>الترتيب</th>
                <th>الحالة</th>
                {role === ROLES.SUPERVISOR && <th style={{ textAlign: 'left' }}>تحكم</th>}
              </tr>
            </thead>
            <tbody>
              {categories.sort((a, b) => a.displayOrder - b.displayOrder).map((cat) => (
                <tr key={cat.id}>
                  <td style={{ fontWeight: 500 }}>{cat.name}</td>
                  <td>{cat.displayOrder}</td>
                  <td>
                    <Badge variant={cat.active ? 'success' : 'neutral'}>
                      {cat.active ? 'نشط' : 'غير نشط'}
                    </Badge>
                  </td>
                  {role === ROLES.SUPERVISOR && (
                    <td>
                      <div className="data-table__actions" style={{ justifyContent: 'flex-end' }}>
                        <Button variant="ghost" size="sm" onClick={() => handleOpenModal(cat)}>
                          <Edit2 size={15} />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => handleDelete(cat.id)} style={{ color: 'var(--danger)' }}>
                          <Trash2 size={15} />
                        </Button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
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
