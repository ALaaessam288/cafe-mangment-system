/*
 * Turns backend error strings and validation errors into intuitive Arabic messages.
 * Every rule answers "so what do I do now?" in Egyptian Arabic with clear guidance.
 */

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

export const RULES = [
  /* ── Quota & Subscriptions ── */
  [/Quota exceeded.*table/i, 'وصلت للحد الأقصى لعدد الطاولات المسموحة في باقتك. يرجى ترقية الباقة لزيادة السعة.'],
  [/Quota exceeded.*user/i, 'وصلت للحد الأقصى لعدد المستخدمين المسموح به في باقتك. يرجى ترقية الباقة لإضافة مستخدمين جدد.'],
  [/Quota exceeded.*product/i, 'وصلت للحد الأقصى لعدد الأصناف المسموحة في باقتك. يرجى ترقية الباقة لإضافة أصناف أخرى.'],
  [/QUOTA_EXCEEDED/i, 'تم تجاوز الحد الأقصى المسموح به في باقة الاشتراك الحالية.'],
  [/ACCOUNT_DISABLED|تم إيقاف هذا الحساب/i, 'تم إيقاف هذا الحساب من قِبل إدارة المنصة. يرجى التواصل مع الدعم الفني للتفعيل.'],
  [/SUBSCRIPTION_EXPIRED|انتهت الفترة التجريبية/i, 'انتهت الفترة التجريبية أو الاشتراك. يرجى تجديد الاشتراك أو تفعيل مفتاح ترخيص جديد.'],

  /* ── Validation Messages ── */
  [/رمز PIN هذا مستخدم بالفعل|PIN.*already in use/i, 'رمز PIN هذا مستخدم بالفعل لموظف آخر في هذا الكافيه. يرجى اختيار رمز PIN فريد.'],
  [/رمز PIN غير صحيح|Invalid PIN/i, 'رمز PIN غير صحيح أو غير مسجل في هذا الكافيه.'],
  [/must not be null|must not be blank|is required/i, 'يرجى ملء جميع الحقول المطلوبة والتأكد من إدخال البيانات بشكل صحيح.'],
  [/must be greater than 0|must be positive/i, 'يجب أن تكون القيمة المدخلة أكبر من الصفر.'],
  [/must be greater than or equal to 0/i, 'يجب ألا تكون القيمة سالبة (صفر أو أكبر).'],
  [/password must be at least/i, 'كلمة المرور يجب أن تتكون من 6 أحرف على الأقل.'],
  [/slug must be lowercase/i, 'المعرف المختصر (Slug) يجب أن يتكون من حروف إنجليزية صغيرة وأرقام وعلامة (-) فقط.'],
  [/Slug already taken/i, 'هذا المعرف (Slug) مستخدم بالفعل، يرجى اختيار اسم أو معرف آخر.'],
  [/Username already taken|Username already exists/i, 'اسم المستخدم هذا مسجل بالفعل لمستخدم آخر، يرجى اختيار اسم مختلف.'],
  [/Table number already exists/i, 'رقم الطاولة هذا مسجل بالفعل، يرجى إدخال رقم مختلف.'],

  /* ── Shifts ── */
  [/You must have an open shift/i, 'لازم تفتح الشيفت الأول. اضغط على «ابدأ الشيفت» وأدخل الفلوس اللي في الدرج.'],
  [/No open shift for the current user/i, 'لا يوجد شيفت مفتوح باسمك حالياً. افتح شيفت جديد لتتمكن من العمل.'],
  [/(There is already an open shift for this register|Register already has an open shift|يوجد شيفت مفتوح بالفعل)/i,
    'يوجد شيفت مفتوح بالفعل على نقطة البيع (الكاشير) المحددة. يرجى إغلاقه أولاً قبل فتح شيفت جديد.'],
  [/Shift is already closed/i, 'هذا الشيفت مغلق بالفعل.'],
  [/You can only close your own shift/i, 'هذا الشيفت باسم مستخدم آخر. سجّل الدخول بصاحب الشيفت، أو اطلب من المشرف/المدير إغلاقه.'],
  [/Shift has open or unpaid orders/i, 'لا يمكن قفل الشيفت قبل تسوية كل الطلبات المفتوحة: ادفعها، أغلقها، أو ألغها أولاً.'],
  [/You can only view your own shift/i, 'يمكنك فقط عرض تفاصيل شيفك الخاص.'],
  [/Register is not active/i, 'هذه الخزينة متوقفة حالياً. تواصل مع الإدارة لتفعيلها.'],

  /* ── Opening an order ── */
  [/Table (\\S+) already has an open order/i, (m) => `طاولة ${m[1]} مشغولة بأوردر مفتوح بالفعل.`],
  [/Dine-in orders require a tableId/i, 'يرجى اختيار الطاولة أولاً لطلبات الصالة.'],
  [/Takeaway orders require a customerName/i, 'يرجى كتابة اسم العميل لطلب التيك أواي.'],
  [/Takeaway orders must not have a tableId/i, 'طلبات التيك أواي لا ترتبط بطاولة.'],
  [/Dine-in orders must not include takeaway pickup details/i, 'طلبات الصالة لا تحتاج بيانات استلام تيك أواي.'],
  [/Table (\\S+) is not active/i, (m) => `طاولة ${m[1]} غير متاحة أو معطلة حالياً.`],
  [/Table not found/i, 'هذه الطاولة غير موجودة. يرجى تحديث الشاشة.'],
  [/Scheduled pickup is only available for restaurant tenants/i, 'تحديد موعد الاستلام متاح للمطاعم فقط.'],
  [/pickupAt must be in the future/i, 'موعد الاستلام يجب أن يكون وقتاً مستقبلياً.'],

  /* ── Items ── */
  [/Only (\d+) unit\(s\) of (.+?) can be added with the available (.+)/i,
    (m) => m[1] === '0'
      ? `لا يمكن إضافة «${m[2].trim()}» — المخزون المتاح من «${m[3].trim()}» غير كافٍ لهذا الطلب.`
      : `المخزون يكفي لـ ${m[1]} وحدة فقط من «${m[2].trim()}» — بسبب نقص «${m[3].trim()}». خفّف الكمية أو راجع المخزون.`],
  [/Product is not available:?\\s*(.*)/i, (m) => `الصنف «${(m[1] || '').trim()}» نفد أو غير متاح حالياً.`],
  [/Product not found/i, 'الصنف المطلوب غير موجود. يرجى تحديث القائمة.'],
  [/Item is already cancelled/i, 'هذا الصنف تم إلغاؤه بالفعل.'],
  [/Only items that have not been sent to the kitchen can be removed/i,
    'تم إرسال هذا الصنف للمطبخ بالفعل. لإلغائه يرجى استخدام زر الإلغاء مع توضيح السبب.'],
  [/Item is (\\w+) and cannot be modified/i, (m) => `الصنف ${itemStatusAr(m[1])} ولا يمكن تعديله.`],
  [/Quantity must be at least 1/i, 'الكمية يجب أن تكون 1 على الأقل.'],
  [/Cannot discount a cancelled item/i, 'لا يمكن تطبيق خصم على صنف ملغي.'],
  [/Order item .* does not belong to order/i, 'الصنف لا ينتمي لهذا الأوردر.'],
  [/Order item not found/i, 'الصنف غير موجود في الأوردر.'],

  /* ── Order state ── */
  [/Order must be fully paid before it can be closed/i, 'يوجد متبقي غير مدفوع على الفاتورة. يرجى تحصيل المبلغ أولاً.'],
  [/Order is already fully paid/i, 'تم سداد الفاتورة بالكامل مسبقاً.'],
  [/Order must be PAID or CLOSED to be refunded/i, 'لا يمكن استرجاع أوردر لم يتم سداده بعد.'],
  [/Order is (\\w+) and cannot accept payments/i, (m) => `الأوردر ${orderStatusAr(m[1])} ولا يقبل عمليات دفع جديدة.`],
  [/Order is (\\w+) and cannot be voided/i, (m) => `الأوردر ${orderStatusAr(m[1])} ولا يمكن إلغاؤه.`],
  [/Order is (\\w+) and cannot be marked served/i, (m) => `الأوردر ${orderStatusAr(m[1])}. يرجى إرساله للمطبخ أولاً.`],
  [/Order is (\\w+) and cannot be modified/i, (m) => `الأوردر ${orderStatusAr(m[1])} ولا يمكن تعديله.`],
  [/Order is already on table (\\S+)/i, (m) => `الأوردر موجود بالفعل على طاولة ${m[1]}.`],
  [/Only dine-in orders can be transferred/i, 'يمكن نقل طلبات الصالة فقط بين الطاولات.'],
  [/Order not found/i, 'الأوردر المطلوب غير موجود.'],

  /* ── Payment ── */
  [/received is required for CASH payments/i, 'يرجى إدخال المبلغ المستلم نقداً من العميل.'],
  [/received cannot be less than amount/i, 'المبلغ المستلم نقداً أقل من القيمة المطلوبة.'],
  [/Amount exceeds remaining balance of\\s*([\\d.]+)/i, (m) => `المبلغ أكبر من المتبقي على الفاتورة (${m[1]} ج.م).`],
  [/Delivery fee must be zero or positive/i, 'رسوم التوصيل يجب أن تكون صفراً أو قيمة موجبة.'],
  [/Service fee must be zero or positive/i, 'رسوم الخدمة يجب أن تكون صفراً أو قيمة موجبة.'],

  /* ── Debts & Employees ── */
  [/Advance amount exceeds/i, 'مبلغ السلفة يتجاوز الحد المسموح به لراتب الموظف.'],
  [/Settlement amount exceeds debt balance/i, 'مبلغ السداد أكبر من إجمالي رصيد المديونية المستحق.'],

  /* ── Session & Auth ── */
  [/(Invalid refresh token|Refresh token expired)/i, 'انتهت الجلسة. يرجى تسجيل الدخول مجدداً.'],
  [/User is deactivated/i, 'هذا الحساب تم تعطيله. يرجى مراجعة إدارة المنشأة.'],
  [/Bad credentials|Invalid username or password|UNAUTHORIZED/i, 'اسم المستخدم أو كلمة المرور غير صحيحة.'],
  [/ACCESS_DENIED|FORBIDDEN/i, 'ليس لديك الصلاحية الكافية لإتمام هذا الإجراء.'],

  /* ── Inventory ── */
  [/Product does not track inventory/i, 'هذا الصنف غير مفعل عليه تتبع المخزون.'],
  [/RESTOCK requires a positive quantityChange/i, 'كمية التوريد يجب أن تكون أكبر من صفر.'],
  [/WASTE requires a negative quantityChange/i, 'كمية الهالك يجب أن تكون قيمة سالبة.'],
  [/quantityChange must not be zero/i, 'كمية تعديل المخزون لا يمكن أن تكون صفراً.'],
];

const BY_STATUS = {
  0: 'تعذر الاتصال بالخادم. يرجى التحقق من اتصال الإنترنت أو تشغيل الخادم.',
  400: 'بيانات غير صالحة. يرجى مراجعة الحقول المدخلة.',
  401: 'انتهت الجلسة أو بيانات الدخول غير صحيحة.',
  403: 'ليس لديك الصلاحية الكافية أو الباقة لا تدعم هذه الميزة.',
  404: 'العنصر المطلوب غير موجود.',
  409: 'يوجد تعارض في البيانات (الاسم أو الرقم مسجل مسبقاً).',
  500: 'حدث خطأ في الخادم. يرجى المحاولة مرة أخرى لاحقاً.',
  503: 'الخدمة غير متوفرة حالياً، جاري معالجة البيانات.',
};

function isArabic(text) {
  return /^[\\s"'«(]*[؀-ۿ]/.test(text);
}

export function toFriendlyMessage(message, status) {
  const raw = (message ?? '').trim();

  for (const [pattern, replacement] of RULES) {
    const match = raw.match(pattern);
    if (match) return typeof replacement === 'function' ? replacement(match) : replacement;
  }

  if (raw && isArabic(raw)) return raw;
  if (BY_STATUS[status]) return BY_STATUS[status];

  return raw || 'حدث خطأ غير متوقع، يرجى المحاولة مرة أخرى.';
}

export default toFriendlyMessage;
