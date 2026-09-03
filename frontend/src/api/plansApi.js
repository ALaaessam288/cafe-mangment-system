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
