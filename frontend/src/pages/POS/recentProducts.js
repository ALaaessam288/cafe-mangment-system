/* ═══════════════════════════════════════════════════════════════
   Per-cashier quick access list.

   Purely a local UI convenience: what THIS cashier rang up most on THIS
   machine, kept in localStorage. It never touches the backend, never changes
   order data, and degrades to nothing if storage is unavailable.
   ═══════════════════════════════════════════════════════════════ */

const PREFIX = 'wanas_pos_recent_';
const MAX_STORED = 60;
const MAX_AGE_MS = 14 * 24 * 60 * 60 * 1000; // two weeks

function keyFor(userId) {
  return `${PREFIX}${userId ?? 'anon'}`;
}

function read(userId) {
  try {
    const raw = localStorage.getItem(keyFor(userId));
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

function write(userId, list) {
  try {
    localStorage.setItem(keyFor(userId), JSON.stringify(list));
  } catch {
    /* quota / private mode - quick access is optional, so just skip */
  }
}

/** Records one sale of a product for this cashier. */
export function recordProductUse(userId, productId, quantity = 1) {
  if (productId == null) return;
  const now = Date.now();
  const list = read(userId).filter((e) => now - (e.t ?? 0) < MAX_AGE_MS);

  const existing = list.find((e) => e.id === productId);
  if (existing) {
    existing.n = (existing.n ?? 0) + quantity;
    existing.t = now;
  } else {
    list.push({ id: productId, n: quantity, t: now });
  }

  list.sort((a, b) => (b.n - a.n) || (b.t - a.t));
  write(userId, list.slice(0, MAX_STORED));
}

/**
 * Resolves the stored ids back to live products.
 * Anything that has since been deactivated or removed simply drops out.
 */
export function getQuickAccessProducts(userId, products, limit = 8) {
  if (!products?.length) return [];
  const now = Date.now();
  const byId = new Map(products.map((p) => [p.id, p]));
  return read(userId)
    .filter((e) => now - (e.t ?? 0) < MAX_AGE_MS)
    .sort((a, b) => (b.n - a.n) || (b.t - a.t))
    .map((e) => byId.get(e.id))
    .filter(Boolean)
    .slice(0, limit);
}
