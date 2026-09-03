import { useState } from 'react';
import { createPortal } from 'react-dom';
import './ProvisionSuccessModal.css';

const PLAN_NAMES = { TRIAL: 'تجربة 14 يوم', STARTER: 'Starter', PRO: 'Pro', ENTERPRISE: 'Enterprise' };

export default function ProvisionSuccessModal({ data, onClose, onViewTenants, onCopy, onWhatsapp, formatMessage }) {
  const [handoffSecured, setHandoffSecured] = useState(false);
  const [confirmDismiss, setConfirmDismiss] = useState(false);
  const loginUrl = data.loginUrl || `${window.location.origin}/${data.slug}/login`;
  const setupChecks = [
    { icon: 'bi-building-check', label: 'مساحة العمل' },
    { icon: 'bi-person-check', label: 'حساب المالك' },
    data.templateId ? { icon: 'bi-journal-check', label: 'المنيو المبدئي' } : null,
    Number(data.defaultTables) > 0 ? { icon: 'bi-grid-3x3-gap', label: `${data.defaultTables} طاولة` } : null,
  ].filter(Boolean);

  async function copy(value, label, securesHandoff = false) {
    const copied = await onCopy(value, label);
    if (copied && securesHandoff) setHandoffSecured(true);
  }

  function openWhatsapp() {
    onWhatsapp(data);
    setHandoffSecured(true);
  }

  function requestClose() {
    if (handoffSecured) onClose();
    else setConfirmDismiss(true);
  }

  return createPortal(
    <div className="sa-modal-backdrop sa-ps-backdrop">
      <section className="sa-ps-dialog" role="dialog" aria-modal="true" aria-labelledby="provision-success-title">
        <header className="sa-ps-hero">
          <div className="sa-ps-orbit"><i className="bi bi-check-lg" /><span /><span /></div>
          <small>PROVISIONING COMPLETE · #{data.tenantId || 'READY'}</small>
          <h2 id="provision-success-title">المنشأة جاهزة للتشغيل</h2>
          <p>تم إنشاء مساحة <strong>{data.name}</strong> وحساب المالك وإعداد نقطة البداية بنجاح.</p>
          <button type="button" onClick={requestClose} aria-label="إغلاق"><i className="bi bi-x-lg" /></button>
        </header>

        <div className="sa-ps-body">
          <div className="sa-ps-checks">{setupChecks.map((item) => <span key={item.label}><i className={`bi ${item.icon}`} /> {item.label}</span>)}</div>

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
              {data.ownerWhatsapp ? <button type="button" className="is-whatsapp" onClick={openWhatsapp}><i className="bi bi-whatsapp" /><span><strong>إرسال عبر واتساب</strong><small>{data.ownerWhatsapp}</small></span><i className="bi bi-arrow-left" /></button> : <div className="sa-ps-missing"><i className="bi bi-info-circle" /><span><strong>لم تتم إضافة واتساب</strong><small>استخدم نسخ الرسالة أو افتح مساحة العمل.</small></span></div>}
              <button type="button" onClick={() => copy(formatMessage(data), 'رسالة التسليم بالكامل', true)}><i className="bi bi-chat-square-text" /><span><strong>نسخ بطاقة التسليم</strong><small>الرابط وبيانات الدخول كاملة</small></span><i className="bi bi-copy" /></button>
              <button type="button" onClick={() => window.open(loginUrl, '_blank', 'noopener,noreferrer')}><i className="bi bi-box-arrow-up-left" /><span><strong>فتح مساحة العمل</strong><small>تأكد من شاشة الدخول</small></span><i className="bi bi-arrow-left" /></button>
            </div>
          </section>

          <div className="sa-ps-security"><i className="bi bi-exclamation-triangle" /><span><strong>تذكير أمني</strong><small>اطلب من المالك تغيير كلمة المرور بعد أول تسجيل دخول، ولا تحتفظ بها في محادثات عامة.</small></span></div>
        </div>

        <footer className="sa-ps-footer">
          <label className={handoffSecured ? 'is-secured' : ''}><input type="checkbox" checked={handoffSecured} onChange={(event) => setHandoffSecured(event.target.checked)} /><i className="bi bi-check-lg" /><span><strong>تم حفظ أو تسليم بيانات الدخول</strong><small>لن تظهر كلمة المرور مرة أخرى بعد إغلاق البطاقة.</small></span></label>
          <button type="button" disabled={!handoffSecured} onClick={onViewTenants}>العودة إلى العملاء <i className="bi bi-arrow-left" /></button>
        </footer>

        {confirmDismiss && (
          <div className="sa-ps-dismiss" role="alertdialog" aria-modal="true" aria-labelledby="provision-dismiss-title">
            <div><i className="bi bi-shield-exclamation" /><h3 id="provision-dismiss-title">لم تؤكد حفظ بيانات الدخول</h3><p>كلمة المرور مؤقتة ولن تظهر مرة أخرى بعد إغلاق هذه البطاقة. انسخ بطاقة التسليم أولاً لتجنب فقدانها.</p><footer><button type="button" onClick={() => setConfirmDismiss(false)}>العودة إلى بطاقة التسليم</button><button type="button" onClick={onClose}>إغلاق رغم ذلك</button></footer></div>
          </div>
        )}
      </section>
    </div>,
    document.body
  );
}
