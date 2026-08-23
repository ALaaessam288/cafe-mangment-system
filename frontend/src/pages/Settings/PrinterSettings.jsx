import { useEffect, useState } from 'react';
import { Printer, RefreshCw, CheckCircle2, Zap, AlertCircle } from 'lucide-react';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';
import Button from '../../components/Button/Button';
import {
  PRINT_TARGETS,
  getPrinterSettings,
  savePrinterSettings,
  listSystemPrinters,
  isElectron,
} from '../../utils/printerSettings';
import { printReceipt } from '../../utils/printUtils';

/**
 * Maps each ticket type to a real Windows printer on THIS terminal, so a kitchen
 * slip and a bar slip can print silently to two different machines instead of
 * throwing two print dialogs at the cashier.
 */
export default function PrinterSettings() {
  const toast = useToast();
  const { user } = useAuth();
  const [printers, setPrinters] = useState([]);
  const [settings, setSettings] = useState(getPrinterSettings);
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    setLoading(true);
    const list = await listSystemPrinters();
    setPrinters(list);

    // Auto-detect POS-80 thermal printer if not configured yet
    const curSettings = getPrinterSettings();
    if (!curSettings.RECEIPT && list.length > 0) {
      const posPrinter = list.find((p) => {
        const n = (p.name + ' ' + (p.displayName || '')).toLowerCase();
        return (
          n.includes('pos') ||
          n.includes('80') ||
          n.includes('receipt') ||
          n.includes('thermal') ||
          n.includes('xp-') ||
          n.includes('11.3')
        );
      });
      if (posPrinter) {
        const autoSet = {
          ...curSettings,
          RECEIPT: posPrinter.name,
          KITCHEN: curSettings.KITCHEN || posPrinter.name,
          BAR: curSettings.BAR || posPrinter.name,
        };
        setSettings(autoSet);
        savePrinterSettings(autoSet);
      }
    }
    setLoading(false);
  };

  useEffect(() => {
    refresh();
  }, []);

  function update(patch) {
    const next = { ...settings, ...patch };
    setSettings(next);
    savePrinterSettings(next);
    toast.success('تم حفظ إعدادات الطابعة');
  }

  function setAllToPrinter(printerName) {
    const next = {
      ...settings,
      RECEIPT: printerName,
      KITCHEN: printerName,
      BAR: printerName,
    };
    setSettings(next);
    savePrinterSettings(next);
    toast.success(`تم تعيين «${printerName}» لجميع الفواتير والبونات بنجاح!`);
  }

  function testPrint(target) {
    const name = settings[target];
    const html = `<!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="UTF-8">
      <style>
        @page { size: 80mm auto; margin: 0; }
        body { font-family: 'Segoe UI', Tahoma, Arial, sans-serif; width: 72mm; max-width: 72mm; margin: 0 auto; padding: 3mm 1mm; text-align: center; color: #000; direction: rtl; }
        .b { background: #000; color: #fff; padding: 5px; border-radius: 4px; font-weight: 800; font-size: 16px; margin-bottom: 6px; }
        h1 { font-size: 18px; font-weight: 800; margin: 6px 0; border-bottom: 2px dashed #000; padding-bottom: 4px; }
        p { font-size: 13px; font-weight: 600; margin: 4px 0; }
        .num { direction: ltr; font-family: Arial; font-weight: bold; }
        .ok { border: 2px solid #000; border-radius: 4px; padding: 6px; margin-top: 8px; font-weight: 800; }
      </style></head>
      <body>
        <div class="b">✦ ${user?.tenantName || 'كافيه ونس'} ✦</div>
        <h1>تجربة طباعة ${PRINT_TARGETS.find((t) => t.id === target)?.label ?? target}</h1>
        <p>الطابعة: <strong>${name || 'الافتراضية (تلقائي)'}</strong></p>
        <p>المقاس: <strong>80mm / 80*210 حراري</strong></p>
        <p class="num">${new Date().toLocaleString('en-GB')}</p>
        <div class="ok">✓ تمت الطباعة بنجاح! النظام جاهز للعمل.</div>
      </body></html>`;

    printReceipt(html, {
      width: 80,
      deviceName: name || undefined,
      silent: settings.silent !== false,
    });
    toast.info('تم إرسال أمر الطباعة التجريبي للطابعة');
  }

  if (!isElectron()) {
    return (
      <div className="section-card">
        <h2 className="section-card__title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Printer size={18} /> إعدادات الطابعات
        </h2>
        <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>
          توزيع واختيار الطابعات الحرارية المباشرة متاح من داخل تطبيق الويندوز (Caffio).
        </p>
      </div>
    );
  }

  // Find any thermal printer to show quick-setup CTA
  const detectedThermal = printers.find((p) => {
    const n = (p.name + ' ' + (p.displayName || '')).toLowerCase();
    return n.includes('pos') || n.includes('80') || n.includes('receipt') || n.includes('thermal');
  });

  return (
    <div className="section-card">
      <h2
        className="section-card__title"
        style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'space-between' }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Printer size={18} /> إعدادات طابعات الفواتير والبونات (80mm / POS-80)
        </span>
        <Button variant="secondary" size="sm" onClick={refresh} loading={loading}>
          <RefreshCw size={14} /> تحديث الطابعات
        </Button>
      </h2>

      {detectedThermal && (
        <div
          style={{
            background: 'rgba(34, 197, 94, 0.1)',
            border: '1px solid rgba(34, 197, 94, 0.3)',
            borderRadius: '8px',
            padding: '12px 14px',
            marginBottom: '14px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
          }}
        >
          <div>
            <div style={{ fontWeight: 800, color: 'var(--success, #22c55e)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Zap size={16} /> تم العثور على طابعة كاشير حرارية: <strong>{detectedThermal.displayName}</strong>
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
              اضغط على الزر لتعيينها تلقائياً لجميع الفواتير وبونات المطبخ والبار.
            </div>
          </div>
          <Button
            variant="primary"
            size="sm"
            onClick={() => setAllToPrinter(detectedThermal.name)}
          >
            ⚡ تعيين للكل
          </Button>
        </div>
      )}

      <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginBottom: '14px', lineHeight: 1.6 }}>
        يدعم النظام طابعات الإيصالات الحرارية مقاس <strong>80mm / 80*210</strong> (مثل POS-80, Xprinter, Epson).
        يمكنك تحديد طابعة خاصة لكل نوع بون، أو تركها للطباعة المباشرة على طابعة الكاشير.
      </p>

      <label className="printer-silent" style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <input
          type="checkbox"
          checked={settings.silent !== false}
          onChange={(e) => update({ silent: e.target.checked })}
        />
        <span>طباعة مباشرة وسريعة (بدون ظهور شاشة ويندوز عند كل فاتورة)</span>
      </label>

      <div className="printer-list">
        {PRINT_TARGETS.map((target) => (
          <div key={target.id} className="printer-row">
            <div className="printer-row__info">
              <span className="printer-row__label">{target.label}</span>
              <span className="printer-row__hint">{target.hint}</span>
            </div>
            <select
              className="field-select__control printer-row__select"
              value={settings[target.id] ?? ''}
              onChange={(e) => update({ [target.id]: e.target.value })}
            >
              <option value="">— طابعة الكاشير التلقائية (POS-80) —</option>
              {printers.map((p) => (
                <option key={p.name} value={p.name}>
                  {p.displayName} {p.isDefault ? '★ (افتراضية النظام)' : ''}
                </option>
              ))}
            </select>
            <Button variant="secondary" size="sm" onClick={() => testPrint(target.id)}>
              تجربة طباعة
            </Button>
          </div>
        ))}
      </div>

      {printers.length === 0 && !loading && (
        <p style={{ fontSize: 'var(--text-xs)', color: 'var(--warning)', marginTop: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <AlertCircle size={14} /> لم يتم العثور على طابعات مثبتة. تأكد من توصيل كابل USB للطابعة وتثبيت التعريف.
        </p>
      )}

      {settings.silent !== false && (
        <p className="printer-ok" style={{ marginTop: '14px', display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--success, #22c55e)', fontSize: '12px' }}>
          <CheckCircle2 size={14} /> الطباعة المباشرة على مقاس 80mm مفعلة بنجاح ✓
        </p>
      )}
    </div>
  );
}
