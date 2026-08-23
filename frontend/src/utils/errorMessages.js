/*
 * Turns backend error strings into something a cashier can act on.
 *
 * The API speaks English and describes state ("Order must be fully paid before it can be closed
 * (current status: SENT)"). That is the right message for a developer reading a log and the wrong
 * one for someone standing at a till with a queue: it names the rule that was broken but not the
 * button to press next. Every rule below answers "so what do I do now?" in the same Egyptian
 * Arabic the rest of the screen uses.
 *
 * Rules are tried in order and the first match wins, so put specific patterns above general ones.
 * Anything unmatched falls through unchanged rather than being hidden behind a vague apology - a
 * strange English string is still more useful to whoever gets called over than "حصل خطأ".
 */

/* Order lifecycle states, for messages that quote the current status back. */
const ORDER_STATUS_AR = {
  OPEN: 'مفتوح',
  SENT: 'متبعت للمطبخ',
  SERVED: 'اتقدّم للعميل',
  READY_FOR_PICKUP: 'جاهز للاستلام',
  PAID: 'مدفوع',
  CLOSED: 'مقفول',
  VOIDED: 'ملغي',
  REFUNDED: 'مرتجع',
};

const ITEM_STATUS_AR = {
  NEW: 'لسه ما اتبعتش',
  SENT: 'اتبعت للمطبخ',
  CANCELLED: 'ملغي',
};

const orderStatusAr = (s) => ORDER_STATUS_AR[s] ?? s;
const itemStatusAr = (s) => ITEM_STATUS_AR[s] ?? s;

/* [pattern, replacement]. Replacement may be a string or a function of the regex match. */
const RULES = [
  /* ── Shift ── */
  [/You must have an open shift/i,
    'لازم تفتح الشيفت الأول. دوس على «ابدأ الشيفت» وأدخل الفلوس اللي في الدرج.'],
  [/No open shift for the current user/i,
    'مفيش شيفت مفتوح باسمك دلوقتي. افتح شيفت جديد عشان تقدر تشتغل.'],
  [/(There is already an open shift for this register|Register already has an open shift)/i,
    'الدرج ده لسه مفتوح من شيفت قبل كده. لازم يتقفل الأول قبل ما تفتح شيفت جديد.'],
  [/Shift is already closed/i, 'الشيفت ده مقفول خلاص.'],
  [/You can only close your own shift/i,
    'مينفعش تقفل شيفت حد تاني. كل واحد بيقفل شيفته بنفسه.'],
  [/You can only view your own shift/i, 'مينفعش تشوف شيفت حد تاني.'],
  [/Register is not active/i, 'الدرج ده مقفول. اختار درج تاني أو كلّم المدير.'],

  /* ── Opening an order ── */
  [/Table (\S+) already has an open order/i,
    (m) => `ترابيزة ${m[1]} مفتوحة بأوردر تاني. دوس عليها من الشمال تشوف الأوردر بتاعها.`],
  [/Dine-in orders require a tableId/i, 'اختار ترابيزة الأول.'],
  [/Takeaway orders require a customerName/i, 'اكتب اسم العميل عشان تعرف الأوردر لمين.'],
  [/Takeaway orders must not have a tableId/i, 'أوردر التيك أواي مالوش ترابيزة.'],
  [/Dine-in orders must not include takeaway pickup details/i,
    'أوردر الصالة مالوش بيانات استلام.'],
  [/Table (\S+) is not active/i,
    (m) => `ترابيزة ${m[1]} مقفولة دلوقتي. اختار ترابيزة تانية.`],
  [/Table not found/i, 'الترابيزة دي مش موجودة. اعمل تحديث للشاشة.'],
  [/Scheduled pickup is only available for restaurant tenants/i,
    'تحديد ميعاد الاستلام متاح للمطاعم بس.'],
  [/pickupAt must be in the future/i, 'ميعاد الاستلام لازم يكون بعد دلوقتي.'],

  /* ── Items ── */
  [/Product is not available:?\s*(.*)/i,
    (m) => `«${(m[1] || 'الصنف').trim()}» خلص أو متوقف دلوقتي. كلّم المدير يرجّعه للمنيو.`],
  [/Product not found/i, 'الصنف ده مش موجود. اقفل الشاشة وافتحها تاني عشان تحدّث المنيو.'],
  [/Item is already cancelled/i, 'الصنف ده ملغي خلاص.'],
  [/Only items that have not been sent to the kitchen can be removed/i,
    'الصنف ده راح للمطبخ خلاص. لازم تلغيه بسبب بدل ما تشيله.'],
  [/Item is (\w+) and cannot be modified/i,
    (m) => `الصنف ده ${itemStatusAr(m[1])}، مش هينفع يتعدّل.`],
  [/Quantity must be at least 1/i, 'الكمية لازم تكون 1 على الأقل. لو عايز تشيله، دوس على (−).'],
  [/Cannot discount a cancelled item/i, 'مينفعش تحط خصم على صنف ملغي.'],
  [/Order item .* does not belong to order/i, 'الصنف ده مش في الأوردر ده. اعمل تحديث للشاشة.'],
  [/Order item not found/i, 'الصنف ده مش موجود في الأوردر. اعمل تحديث للشاشة.'],

  /* ── Order state ── */
  [/Order must be fully paid before it can be closed \(current status:\s*(\w+)/i,
    () => 'لسه فيه باقي على الفاتورة. حصّل الباقي الأول وبعدين اقفل الأوردر.'],
  [/Order is already fully paid/i, 'الفاتورة اتدفعت بالكامل خلاص.'],
  [/Order must be PAID or CLOSED to be refunded/i,
    'مينفعش ترجّع فلوس على أوردر لسه ما اتدفعش.'],
  [/Order is (\w+) and cannot accept payments/i,
    (m) => `الأوردر ده ${orderStatusAr(m[1])}، مش هينفع تسجّل عليه دفع.`],
  [/Order is (\w+) and cannot be voided/i,
    (m) => `الأوردر ده ${orderStatusAr(m[1])}، مش هينفع يتلغي.`],
  [/Order is (\w+) and cannot be marked served/i,
    (m) => `الأوردر ده ${orderStatusAr(m[1])}. ابعته للمطبخ الأول.`],
  [/Order is (\w+) and cannot be modified/i,
    (m) => `الأوردر ده ${orderStatusAr(m[1])}، مش هينفع تزوّد أو تشيل منه.`],
  [/Order is already on table (\S+)/i, (m) => `الأوردر أصلاً على ترابيزة ${m[1]}.`],
  [/Only dine-in orders can be transferred/i, 'أوردر التيك أواي مينفعش يتنقل لترابيزة.'],
  [/Order not found/i, 'الأوردر ده مش موجود. اعمل تحديث للشاشة.'],

  /* ── Payment ── */
  [/received is required for CASH payments/i, 'اكتب المبلغ اللي استلمته من العميل.'],
  [/received cannot be less than amount/i,
    'المبلغ اللي استلمته أقل من المطلوب. راجع الرقم.'],
  [/Amount exceeds remaining balance of\s*([\d.]+)/i,
    (m) => `المبلغ أكبر من الباقي على الفاتورة (${m[1]} ج.م). صحّح الرقم.`],
  [/Delivery fee must be zero or positive/i, 'رسوم التوصيل لازم تكون صفر أو أكتر.'],
  [/Service fee must be zero or positive/i, 'رسوم الخدمة لازم تكون صفر أو أكتر.'],

  /* ── Session ── */
  [/(Invalid refresh token|Refresh token expired)/i,
    'الجلسة انتهت. سجّل دخول تاني.'],
  [/User is deactivated/i, 'الحساب ده متوقف. كلّم المدير.'],
  [/Bad credentials|Invalid username or password/i, 'اسم المستخدم أو الباسورد غلط.'],

  /* ── Inventory ── */
  [/Product does not track inventory/i, 'الصنف ده مش متسجل عليه مخزون.'],
  [/RESTOCK requires a positive quantityChange/i, 'كمية التوريد لازم تكون أكبر من صفر.'],
  [/WASTE requires a negative quantityChange/i, 'كمية الهالك لازم تكون بالسالب.'],
  [/quantityChange must not be zero/i, 'الكمية مينفعش تكون صفر.'],
];

/* Status-only fallbacks, used when nothing above matched. */
const BY_STATUS = {
  0: 'مفيش اتصال بالسيرفر. لو التطبيق لسه بيفتح استنى شوية، وإلا كلّم الدعم.',
  401: 'الجلسة انتهت. سجّل دخول تاني.',
  403: 'الصلاحية دي مش متاحة ليك. كلّم المدير.',
  404: 'الحاجة دي مش موجودة. اعمل تحديث للشاشة.',
  500: 'حصلت مشكلة في السيرفر. جرّب تاني، ولو اتكررت كلّم الدعم.',
  503: 'السيرفر مش شغال دلوقتي. استنى شوية وجرّب تاني.',
};

/**
 * True for messages already written in Arabic at the source (a few in OrderService are).
 *
 * Tests the *opening* characters rather than "contains an Arabic letter anywhere": several English
 * messages interpolate Arabic data, e.g. `Product is not available: لاتيه`, and a contains-check
 * would wave those through untranslated.
 */
function isArabic(text) {
  return /^[\s"'«(]*[؀-ۿ]/.test(text);
}

/**
 * @param {string} message raw message from the API
 * @param {number} [status] HTTP status, used only when no rule matches
 * @returns {string} something the cashier can act on
 */
export function toFriendlyMessage(message, status) {
  const raw = (message ?? '').trim();

  // Rules first: a rule is always a better answer than passing the original through, including
  // for the English-with-Arabic-data messages that isArabic deliberately does not claim.
  for (const [pattern, replacement] of RULES) {
    const match = raw.match(pattern);
    if (match) return typeof replacement === 'function' ? replacement(match) : replacement;
  }

  if (raw && isArabic(raw)) return raw;

  if (BY_STATUS[status]) return BY_STATUS[status];

  return raw || 'حصلت مشكلة غير متوقعة. جرّب تاني.';
}

export default toFriendlyMessage;
