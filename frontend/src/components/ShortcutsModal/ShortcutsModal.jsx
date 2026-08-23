import { X, Keyboard, Command, Sparkles } from 'lucide-react';
import './ShortcutsModal.css';

export default function ShortcutsModal({ isOpen, onClose }) {
  if (!isOpen) return null;

  const shortcutGroups = [
    {
      title: 'التنقل العام والبحث',
      shortcuts: [
        { keys: ['Ctrl', 'K'], label: 'البحث الشامل والأوامر السريعة (Omni-Search)' },
        { keys: ['F1', 'أو', '?'], label: 'فتح دليل اختصارات لوحة المفاتيح' },
        { keys: ['Esc'], label: 'إغلاق النوافذ المنبثقة والقائمة الجانبية' },
        { keys: ['F11'], label: 'التبديل بين ملء الشاشة والشاشة العادية' },
      ],
    },
    {
      title: 'شاشة الكاشير ونقطة البيع (POS)',
      shortcuts: [
        { keys: ['F2'], label: 'التركيز الفوري على شريط البحث في المنيو' },
        { keys: ['F4'], label: 'إرسال الطلب لمحطات التحضير (المطبخ والبار)' },
        { keys: ['F9'], label: 'فتح نافذة تحصيل الفاتورة والدفع' },
        { keys: ['Ctrl', 'N'], label: 'فتح أوردر تيك أواي / دليفري جديد' },
        { keys: ['Ctrl', 'P'], label: 'إعادة طباعة إيصال الفاتورة الحالية' },
      ],
    },
  ];

  return (
    <div className="shortcuts-overlay" onClick={onClose}>
      <div className="shortcuts-modal" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="shortcuts-header">
          <div className="shortcuts-header__title">
            <Keyboard size={18} className="shortcuts-header__icon" />
            <span>اختصارات لوحة المفاتيح للكاشير ⚡</span>
          </div>
          <button type="button" className="shortcuts-close-btn" onClick={onClose} aria-label="إغلاق">
            <X size={16} />
          </button>
        </div>

        {/* Content */}
        <div className="shortcuts-body">
          {shortcutGroups.map((group, gIdx) => (
            <div key={gIdx} className="shortcuts-group">
              <div className="shortcuts-group__title">{group.title}</div>
              <div className="shortcuts-list">
                {group.shortcuts.map((s, sIdx) => (
                  <div key={sIdx} className="shortcuts-row">
                    <span className="shortcuts-row__label">{s.label}</span>
                    <div className="shortcuts-row__keys">
                      {s.keys.map((k, kIdx) => (
                        <kbd key={kIdx} className={`shortcuts-key ${k === 'أو' ? 'shortcuts-key--sep' : ''}`}>
                          {k}
                        </kbd>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="shortcuts-footer">
          <Sparkles size={13} style={{ color: 'var(--accent)' }} />
          <span>تساعدك هذه الاختصارات على إنجاز وتحصيل الطلبات في ثوانٍ معدودة.</span>
        </div>
      </div>
    </div>
  );
}
