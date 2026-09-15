/* ═══════════════════════════════════════════════════════════════
   Table status — one vocabulary, presentation only.

   The backend knows OPEN / SENT / SERVED / READY_FOR_PICKUP and nothing here changes that. What
   it does not know is how to say them to a cashier mid-rush, and the till used to answer that
   with a coloured dot. Colour alone is a poor status: it needs a legend, it reads the same to
   about one man in twelve, and it cannot say "twelve minutes" - which is the thing a floor
   manager actually wants to know about a table.

   So every status maps to a short Arabic phrase here, once, and both the grid and the context
   badge read from this file rather than each inventing their own wording.
   ═══════════════════════════════════════════════════════════════ */

export const TABLE_STATUS = {
  free: 'فاضية',
  open: 'مفتوحة',
  sent: 'في المطبخ',
  served: 'جاهزة',
  awaiting_payment: 'مستنية الحساب',
};

/** The live order sitting on a table, if any. */
export function orderForTable(tableId, orders = []) {
  return orders.find(
    (o) => o.tableId === tableId
      && ['OPEN', 'SENT', 'SERVED', 'READY_FOR_PICKUP'].includes(o.status)
  ) ?? null;
}

/**
 * Presentation status for a table or an order.
 *
 * <p>"Served but still owing" is called out separately: on the backend it is just SERVED, but on
 * the floor a table that has eaten and not paid is a different job from one still waiting on
 * food, and it is the one nobody should walk past.
 */
export function statusKey(order) {
  if (!order) return 'free';
  const due = parseFloat(order.balanceDue);
  if ((order.status === 'SERVED' || order.status === 'READY_FOR_PICKUP') && due > 0) {
    return 'awaiting_payment';
  }
  if (order.status === 'SERVED' || order.status === 'READY_FOR_PICKUP') return 'served';
  if (order.status === 'SENT') return 'sent';
  return 'open';
}

export function statusLabel(order) {
  return TABLE_STATUS[statusKey(order)];
}

/** Whole minutes since the order was opened, or null when there is no order to time. */
export function minutesOpen(order) {
  if (!order?.openedAt) return null;
  const opened = new Date(order.openedAt).getTime();
  if (Number.isNaN(opened)) return null;
  const minutes = Math.floor((Date.now() - opened) / 60000);
  return minutes >= 0 ? minutes : null;
}

/**
 * "مفتوحة من 12 دقيقة" - the status with its age, when the age adds something.
 *
 * <p>Under a minute it says "دلوقتي" rather than "من 0 دقيقة", and past an hour it switches to
 * hours, because "من 143 دقيقة" is a number the reader has to do arithmetic on.
 */
export function statusWithAge(order) {
  const label = statusLabel(order);
  const minutes = minutesOpen(order);
  if (minutes === null || statusKey(order) === 'free') return label;
  if (minutes < 1) return `${label} دلوقتي`;
  if (minutes < 60) return `${label} من ${minutes} دقيقة`;
  const hours = Math.floor(minutes / 60);
  return `${label} من ${hours} ساعة`;
}
