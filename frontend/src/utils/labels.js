/*
 * One word per concept, everywhere on the till.
 *
 * The same action used to be called four different things depending on where the cashier was
 * looking: the button said "إرسال للأقسام (المطبخ / البار)", the hint above it said "إرسال للمطبخ /
 * البار", the toast afterwards said "الأوردر اتبعت للمطبخ", and the badge on the line then read
 * "تم الإرسال". A cashier with average computer confidence reads those as four separate things and
 * stops trusting that they understand the screen. Every string below has exactly one home.
 *
 * Rules of thumb when adding to this file:
 *  - Use the verb the staff actually say out loud, not the one the database column is named after.
 *  - Buttons are imperative and short. The screen has no room and the cashier has no time.
 *  - Never put a status the backend uses (SENT, VOIDED) in front of a user.
 */

/* ── The three steps of an order, in the order they happen ── */
export const ACTIONS = {
  SEND: 'ابعت للمطبخ',
  SERVE_DINE_IN: 'طلع بالأوردر',
  SERVE_TAKEAWAY: 'جاهز للاستلام',
  PAY: 'احسب الفاتورة',
};

/* Shown above the primary button: what to do right now, phrased as the step and nothing else. */
export const NEXT_STEP = {
  SEND: 'الخطوة الجاية: ابعت للمطبخ',
  SERVE_DINE_IN: 'الخطوة الجاية: طلع بالأوردر',
  SERVE_TAKEAWAY: 'الخطوة الجاية: سلّم الأوردر للعميل',
  PAY: 'الخطوة الجاية: احسب الفاتورة',
};

/* Confirmation after each step. Same verb as the button that triggered it. */
export const DONE = {
  SEND: 'الأوردر اتبعت للمطبخ',
  SERVE_DINE_IN: 'الأوردر طلع للترابيزة',
  SERVE_TAKEAWAY: 'الأوردر جاهز للاستلام',
  PAY: 'تم الحساب والأوردر اتقفل',
};

/* ── Line status, in the cashier's words ──
   Deliberately mirrors ACTIONS.SEND: a line is either waiting to be sent or already sent. */
export const ITEM_STATUS = {
  NEW: 'لسه ما اتبعتش',
  PENDING: 'بيتسجل...',
  SENT: 'اتبعت للمطبخ',
  CANCELLED: 'ملغي',
};

export const ITEM_STATUS_VARIANT = {
  NEW: 'warning',
  PENDING: 'warning',
  SENT: 'info',
  CANCELLED: 'danger',
};

/* ── Order status, for the badges at the bottom of the panel ── */
export const ORDER_STATUS = {
  OPEN: 'مفتوح',
  SENT: 'عند المطبخ',
  SERVED: 'اتقدّم',
  READY_FOR_PICKUP: 'جاهز للاستلام',
  PAID: 'اتدفع',
  CLOSED: 'اتقفل',
  VOIDED: 'ملغي',
  REFUNDED: 'مرتجع',
};

export const itemStatusLabel = (status) => ITEM_STATUS[status] ?? status;
export const itemStatusVariant = (status) => ITEM_STATUS_VARIANT[status] ?? 'neutral';
export const orderStatusLabel = (status) => ORDER_STATUS[status] ?? status;

/** The serve step reads differently at a table than at a takeaway counter. */
export const serveAction = (orderType) =>
  orderType === 'TAKEAWAY' ? ACTIONS.SERVE_TAKEAWAY : ACTIONS.SERVE_DINE_IN;

export const serveNextStep = (orderType) =>
  orderType === 'TAKEAWAY' ? NEXT_STEP.SERVE_TAKEAWAY : NEXT_STEP.SERVE_DINE_IN;

export const serveDone = (orderType) =>
  orderType === 'TAKEAWAY' ? DONE.SERVE_TAKEAWAY : DONE.SERVE_DINE_IN;
