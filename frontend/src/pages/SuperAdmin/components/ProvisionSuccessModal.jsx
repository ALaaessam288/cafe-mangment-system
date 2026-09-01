import { createPortal } from 'react-dom';
import './ProvisionSuccessModal.css';

const PLAN_NAMES = { TRIAL: 'تجربة 14 يوم', STARTER: 'Starter', PRO: 'Pro', ENTERPRISE: 'Enterprise' };

export default function ProvisionSuccessModal({ data, onClose, onCopy, onWhatsapp, formatMessage }) {
  const loginUrl = data.loginUrl || `${window.location.origin}/${data.slug}/login`;
  const copy = (value, label) => onCopy(value, label);

  return createPortal(
    <div className="sa-modal-backdrop sa-ps-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="sa-ps-dialog" role="dialog" aria-modal="true" aria-labelledby="provision-success-title">
        <header className="sa-ps-hero">
          <div className="sa-ps-orbit"><i className="bi bi-check-lg" /><span /><span /></div>
          <small>PROVISIONING COMPLETE · #{data.tenantId || 'READY'}</small>
          <h2 id="provision-success-title">المنشأة جاهزة للتشغيل</h2>
          <p>تم إنشاء مساحة <strong>{data.name}</strong> وحساب المالك وإعداد نقطة البداية بنجاح.</p>
          <button type="button" onClick={onClose} aria-label="إغلاق"><i className="bi bi-x-lg" /></button>
        </header>

        <div className="sa-ps-body">
          <div className="sa-ps-checks"><span><i className="bi bi-check-circle-fill" /> مساحة العمل</span><span><i className="bi bi-check-circle-fill" /> حساب المالك</span><span><i className="bi bi-check-circle-fill" /> المنيو والطاولات</span></div>

          <section className="sa-ps-access">
            <header><div><i className="bi bi-shield-lock" /><span><strong>بطاقة التسليم الآمن</strong><small>انسخ البيانات أو أرسل الرسالة الجاهزة للمالك</small></span></div><b>{PLAN_NAMES[data.subscriptionPlan] || data.subscriptionPlan}</b></header>
            <div className="sa-ps-access__row"><span><small>رابط تسجيل الدخول</small><code dir="ltr">{loginUrl}</code></span><button type="button" onClick={() => copy(loginUrl, 'رابط تسجيل الدخول')}><i className="bi bi-copy" /> نسخ</button></div>
            <div className="sa-ps-access__credentials">
              <span><small>اسم المستخدم</small><code dir="ltr">{data.ownerUsername}</code><button type="button" onClick={() => copy(data.ownerUsername, 'اسم المستخدم')} aria-label="نسخ اسم المستخدم"><i className="bi bi-copy" /></button></span>
              <span><small>كلمة المرور الأولى</small><code dir="ltr">{data.ownerPassword}</code><button type="button" onClick={() => copy(data.ownerPassword, 'كلمة المرور')} aria-label="نسخ كلمة المرور"><i className="bi bi-copy" /></button></span>
            </div>
          </section>

          <section className="sa-ps-next">
            <header><span>الخطوة التالية</span><small>اختر طريقة تسليم الحساب</small></header>
            <div>
              {data.ownerWhatsapp ? <button type="button" className="is-whatsapp" onClick={() => onWhatsapp(data)}><i className="bi bi-whatsapp" /><span><strong>إرسال عبر واتساب</strong><small>{data.ownerWhatsapp}</small></span><i className="bi bi-arrow-left" /></button> : <div className="sa-ps-missing"><i className="bi bi-info-circle" /><span><strong>لم تتم إضافة واتساب</strong><small>استخدم نسخ الرسالة أو افتح مساحة العمل.</small></span></div>}
              <button type="button" onClick={() => copy(formatMessage(data), 'رسالة التسليم بالكامل')}><i className="bi bi-chat-square-text" /><span><strong>نسخ رسالة التسليم</strong><small>نص جاهز للمشاركة</small></span><i className="bi bi-copy" /></button>
              <button type="button" onClick={() => window.open(loginUrl, '_blank', 'noopener,noreferrer')}><i className="bi bi-box-arrow-up-left" /><span><strong>فتح مساحة العمل</strong><small>تأكد من شاشة الدخول</small></span><i className="bi bi-arrow-left" /></button>
            </div>
          </section>

          <div className="sa-ps-security"><i className="bi bi-exclamation-triangle" /><span><strong>تذكير أمني</strong><small>اطلب من المالك تغيير كلمة المرور بعد أول تسجيل دخول، ولا تحتفظ بها في محادثات عامة.</small></span></div>
        </div>

        <footer className="sa-ps-footer"><span><i className="bi bi-activity" /> أصبحت المنشأة ظاهرة الآن في قائمة العملاء.</span><button type="button" onClick={onClose}>العودة إلى العملاء <i className="bi bi-arrow-left" /></button></footer>
      </section>
    </div>,
    document.body
  );
}
