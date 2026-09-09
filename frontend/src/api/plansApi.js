import client from './client';

/*
 * The plan catalogue, served by the backend.
 *
 * Plans used to be a hardcoded array in FirstTimePlanModal and a second, different hardcoded set of
 * numbers in SuperAdminPage — neither of which matched what the server enforced. The PRO card
 * promised 25 tables and unlimited menu items against a real 50 and 500, so customers were shown
 * terms the API would refuse. There is one source now.
 */
export const plansApi = {
  /** Public pricing grid. Excludes retired and CUSTOM plans. */
  list: () => client.get('/plans').then((r) => r.data),

  /** Every feature the platform knows about, for the super-admin's plan editor. */
  features: () => client.get('/plans/features').then((r) => r.data),

  // ── Platform owner ──
  listAll: () => client.get('/admin/plans').then((r) => r.data),
  create: (payload) => client.post('/admin/plans', payload).then((r) => r.data),
  update: (id, payload) => client.put(`/admin/plans/${id}`, payload).then((r) => r.data),
  retire: (id) => client.delete(`/admin/plans/${id}`).then((r) => r.data),
  subscribers: (id) => client.get(`/admin/plans/${id}/subscribers`).then((r) => r.data),
};

/** -1 is the server's sentinel for "no ceiling". */
export const UNLIMITED = -1;

export const isUnlimited = (limit) => limit === UNLIMITED;

export const formatLimit = (limit, unit = '') =>
  isUnlimited(limit) ? 'بلا حدود ♾' : `${limit}${unit ? ` ${unit}` : ''}`;

/*
 * Whether a plan limit has actually been reached.
 *
 * Three screens each wrote this by hand as `limit && used >= limit`, which gets an unlimited plan
 * exactly backwards: UNLIMITED is -1, which is truthy, and `used >= -1` is true for any count. So a
 * tenant on an unlimited plan was blocked from adding the FIRST extra user, table or product, and
 * told they had "3 من أصل -1". A limit of null/undefined means "not loaded yet", which is also not
 * a reason to block.
 */
export const quotaReached = (used, limit) =>
  limit != null && !isUnlimited(limit) && Number(used) >= Number(limit);

/** "3 / 10", or "3 / بلا حدود ♾" — never "3 / -1". */
export const quotaText = (used, limit) =>
  `${used} / ${limit == null ? '—' : isUnlimited(limit) ? 'بلا حدود ♾' : limit}`;

/** True when a limit is worth showing at all (a real ceiling, or a stated "unlimited"). */
export const hasStatedLimit = (limit) => limit != null;
