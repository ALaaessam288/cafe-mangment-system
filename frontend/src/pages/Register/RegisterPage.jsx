import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Coffee, ArrowLeft, ArrowRight, Utensils, Store, ChevronLeft } from 'lucide-react';
import { tenantApi } from '../../api/tenantApi';
import { useToast } from '../../context/ToastContext';
import { ROUTES } from '../../utils/constants';
import Input from '../../components/Input/Input';
import Button from '../../components/Button/Button';
import './RegisterPage.css';

const BUSINESS_TYPES = [
  { 
    id: 'CAFE', 
    title: 'كافيه', 
    desc: 'إدارة المشروبات، الحلويات، ونظام التيك أواي', 
    icon: Coffee 
  },
  { 
    id: 'RESTAURANT', 
    title: 'مطعم', 
    desc: 'إدارة الأطباق، حجز الترابيزات، وشاشات المطبخ', 
    icon: Utensils 
  },
  { 
    id: 'CAFE_AND_RESTAURANT', 
    title: 'كافيه ومطعم', 
    desc: 'شامل كل المميزات لإدارة نشاطك المتكامل', 
    icon: Store 
  }
];

export default function RegisterPage() {
  const navigate = useNavigate();
  const toast = useToast();
  
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    name: '',
    slug: '',
    ownerFullName: '',
    ownerUsername: '',
    ownerPassword: '',
    businessType: 'CAFE',
  });

  const handleChange = (e) => {
    let { name, value } = e.target;
    if (name === 'slug') {
      value = value.toLowerCase().replace(/[^a-z0-9-]/g, '');
    }
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSlugify = () => {
    if (!form.slug && form.name) {
      const suggestedSlug = form.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');
      setForm((prev) => ({ ...prev, slug: suggestedSlug }));
    }
  };

  const handleSelectType = (typeId) => {
    setForm(prev => ({ ...prev, businessType: typeId }));
    setStep(2);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!form.name.trim()) return toast.warning('لازم تدخل اسم المكان');
    if (!form.slug.trim()) return toast.warning('لازم تدخل كود مساحة العمل');
    if (!/^[a-z0-9-]+$/.test(form.slug)) return toast.warning('كود مساحة العمل لازم يكون حروف إنجليزية صغيرة وأرقام وشرطة بس');
    if (!form.ownerFullName.trim()) return toast.warning('لازم تدخل اسمك بالكامل');
    if (!form.ownerUsername.trim()) return toast.warning('لازم تدخل اسم المستخدم للأدمن');
    if (form.ownerPassword.length < 8) {
      toast.warning('الباسورد لازم يكون على الأقل 8 حروف');
      return;
    }

    setLoading(true);
    try {
      await tenantApi.provision({
        ...form,
        timezone: 'Africa/Cairo',
        currency: 'EGP'
      });
      toast.success('تم إنشاء حسابك بنجاح! لو سمحت سجل دخول.');
      navigate(ROUTES.LOGIN, { state: { defaultSlug: form.slug } });
    } catch (err) {
      toast.error(err.message, 'فشل التسجيل');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="register-layout">
      <div className="register-container">
        
        {step === 1 && (
          <div className="register-step fade-in">
            <div className="register-header">
              <div className="register-logo">
                <Store size={32} />
              </div>
              <h1>حدد نوع نشاطك</h1>
              <p>عشان نقدر نخصص لك مساحة العمل وتكون مناسبة لاحتياجاتك</p>
            </div>

            <div className="business-type-grid">
              {BUSINESS_TYPES.map(type => (
                <button 
                  key={type.id}
                  className={`business-type-card ${form.businessType === type.id ? 'active' : ''}`}
                  onClick={() => handleSelectType(type.id)}
                  type="button"
                >
                  <div className="type-card-icon">
                    <type.icon size={28} />
                  </div>
                  <div className="type-card-content">
                    <h3>{type.title}</h3>
                    <p>{type.desc}</p>
                  </div>
                  <div className="type-card-arrow">
                    <ChevronLeft size={20} />
                  </div>
                </button>
              ))}
            </div>

            <div className="register-footer">
              عندك مساحة عمل فعلاً؟ <Link to={ROUTES.LOGIN}>سجل دخول من هنا</Link>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="register-step slide-in-right">
            <div className="register-back">
              <button type="button" onClick={() => setStep(1)} className="btn-back">
                <ArrowRight size={20} />
                <span>رجوع لنوع النشاط</span>
              </button>
            </div>

            <div className="register-header">
              <h1>بيانات التسجيل</h1>
              <p>هنجهز مساحة العمل الخاصة بـ <strong>{BUSINESS_TYPES.find(t => t.id === form.businessType)?.title}</strong></p>
            </div>

            <form onSubmit={handleSubmit} className="register-form">
              <div className="form-section">
                <h3 className="form-section-title">بيانات المكان</h3>
                <Input
                  name="name"
                  label="اسم المكان"
                  placeholder="مثال: ونس"
                  value={form.name}
                  onChange={handleChange}
                  onBlur={handleSlugify}
                  required
                  autoFocus
                />
                <Input
                  name="slug"
                  label="كود مساحة العمل (Slug)"
                  placeholder="مثال: wanas"
                  value={form.slug}
                  onChange={handleChange}
                  hint="بيُستخدم وقت الدخول. حروف إنجليزية سمول وأرقام وشرط بس."
                  required
                  pattern="[a-z0-9-]+"
                />
              </div>

              <div className="form-section">
                <h3 className="form-section-title">حساب الأدمن</h3>
                <Input
                  name="ownerFullName"
                  label="اسمك بالكامل"
                  placeholder="مثال: أحمد علي"
                  value={form.ownerFullName}
                  onChange={handleChange}
                  required
                />
                <Input
                  name="ownerUsername"
                  label="اسم المستخدم للأدمن"
                  placeholder="مثال: admin"
                  value={form.ownerUsername}
                  onChange={handleChange}
                  required
                />
                <Input
                  name="ownerPassword"
                  label="باسورد الأدمن"
                  type="password"
                  placeholder="8 حروف على الأقل"
                  value={form.ownerPassword}
                  onChange={handleChange}
                  required
                />
              </div>

              <Button
                type="submit"
                className="register-submit"
                loading={loading}
                leftIcon={<ArrowLeft size={18} />}
              >
                إنشاء مساحة العمل
              </Button>
            </form>
          </div>
        )}

      </div>
    </div>
  );
}
