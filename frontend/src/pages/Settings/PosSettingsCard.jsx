import { useEffect, useMemo, useState } from 'react';
import { Droplet } from 'lucide-react';
import { tenantApi } from '../../api/tenantApi';
import { menuApi } from '../../api/menuApi';
import { useToast } from '../../context/ToastContext';
import { findWaterProduct } from '../POS/waterProduct';
import Button from '../../components/Button/Button';
import Spinner from '../../components/Spinner/Spinner';

/* Which product the cashier's «إضافة مياه» button adds.

   Saved on the café, not on this device, so every till behaves the same. Left empty, the button
   keeps matching the first product named مياه / water - the card says which one that is, so the
   owner can see what "automatic" currently means before deciding whether to change it. */
export default function PosSettingsCard() {
  const toast = useToast();
  const [products, setProducts] = useState([]);
  const [selected, setSelected] = useState('');
  const [saved, setSaved] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    Promise.all([tenantApi.getMe(), menuApi.getProducts()])
      .then(([tenant, all]) => {
        if (cancelled) return;
        const current = tenant?.defaultWaterProductId != null ? String(tenant.defaultWaterProductId) : '';
        setProducts((all ?? []).filter((p) => p.active));
        setSelected(current);
        setSaved(current);
      })
      .catch((err) => toast.error(err.message, 'فشل في تحميل إعدادات الكاشير'))
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [toast]);

  const automatic = useMemo(() => findWaterProduct(products, null), [products]);

  async function handleSave() {
    setSaving(true);
    try {
      await tenantApi.updatePosSettings({ defaultWaterProductId: selected ? Number(selected) : null });
      setSaved(selected);
      toast.success('تم حفظ صنف المياه. هيتطبق على الكاشير بعد تحديث الشاشة.');
    } catch (err) {
      toast.error(err.message, 'فشل في حفظ الإعداد');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="section-card">
      <h2 className="section-card__title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <Droplet size={18} /> زرار «إضافة مياه» في الكاشير
      </h2>
      <p className="section-card__subtitle">اختار الصنف اللي الزرار يضيفه للفاتورة بلمسة واحدة.</p>

      {loading ? (
        <Spinner />
      ) : (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center', marginTop: '12px' }}>
          <select
            className="field-select__control"
            style={{ flex: '1 1 240px', minWidth: 0 }}
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
            aria-label="صنف المياه"
          >
            <option value="">
              تلقائي - {automatic ? `حالياً: ${automatic.nameAr || automatic.nameEn}` : 'مفيش صنف اسمه مياه'}
            </option>
            {products.map((p) => (
              <option key={p.id} value={String(p.id)}>
                {p.nameAr || p.nameEn}{p.categoryNameAr ? ` - ${p.categoryNameAr}` : ''}
              </option>
            ))}
          </select>
          <Button onClick={handleSave} disabled={saving || selected === saved}>
            {saving ? 'جاري الحفظ...' : 'حفظ'}
          </Button>
        </div>
      )}
    </div>
  );
}
