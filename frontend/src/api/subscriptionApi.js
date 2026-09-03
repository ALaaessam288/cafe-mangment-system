import client from './client';

/** The signed-in tenant's own subscription, usage and invoices. */
export const subscriptionApi = {
  current: () => client.get('/tenant/subscription').then((r) => r.data),
  history: () => client.get('/tenant/subscription/history').then((r) => r.data),
  usage: () => client.get('/tenant/usage').then((r) => r.data),
  invoices: () => client.get('/tenant/invoices').then((r) => r.data),
};

/*
 * Upgrading by bank transfer. There is no payment gateway: the café transfers the money and the
 * platform confirms it. This used to be a WhatsApp link and nothing else, so an upgrade left no
 * record on either side.
 */
export const upgradeApi = {
  bankDetails: () => client.get('/tenant/bank-details').then((r) => r.data),
  mine: () => client.get('/tenant/upgrade-requests').then((r) => r.data),
  submit: (payload) => client.post('/tenant/upgrade-requests', payload).then((r) => r.data),
  withdraw: (id) => client.post(`/tenant/upgrade-requests/${id}/withdraw`).then((r) => r.data),
};

/** Platform-owner review of those requests. */
export const upgradeAdminApi = {
  list: (pendingOnly = false) =>
    client.get('/admin/upgrade-requests', { params: { pendingOnly } }).then((r) => r.data),
  approve: (id, payload) =>
    client.post(`/admin/upgrade-requests/${id}/approve`, payload).then((r) => r.data),
  reject: (id, reason) =>
    client.post(`/admin/upgrade-requests/${id}/reject`, { reason }).then((r) => r.data),
};

/** Platform-owner subscription and billing operations. */
export const platformSubscriptionApi = {
  get: (tenantId) => client.get(`/admin/tenants/${tenantId}/subscription`).then((r) => r.data),
  history: (tenantId) => client.get(`/admin/tenants/${tenantId}/subscription/history`).then((r) => r.data),
  usage: (tenantId) => client.get(`/admin/tenants/${tenantId}/usage`).then((r) => r.data),

  changePlan: (tenantId, payload) =>
    client.put(`/admin/tenants/${tenantId}/subscription/plan`, payload).then((r) => r.data),
  extend: (tenantId, days, invoice = false, note = null) =>
    client.post(`/admin/tenants/${tenantId}/subscription/extend`, { days, invoice, note }).then((r) => r.data),
  renew: (tenantId) =>
    client.post(`/admin/tenants/${tenantId}/subscription/renew`).then((r) => r.data),
  setOverrides: (tenantId, payload) =>
    client.put(`/admin/tenants/${tenantId}/subscription/overrides`, payload).then((r) => r.data),
  setGraceDays: (tenantId, graceDays) =>
    client.put(`/admin/tenants/${tenantId}/subscription/grace`, { graceDays }).then((r) => r.data),
  cancel: (tenantId, reason) =>
    client.post(`/admin/tenants/${tenantId}/subscription/cancel`, { reason }).then((r) => r.data),
  suspend: (tenantId, reason) =>
    client.post(`/admin/tenants/${tenantId}/suspend`, { reason }).then((r) => r.data),
  resume: (tenantId) =>
    client.post(`/admin/tenants/${tenantId}/resume`).then((r) => r.data),
};

/** Invoices, payments and revenue. */
export const billingApi = {
  stats: () => client.get('/admin/billing/stats').then((r) => r.data),
  invoices: (tenantId) => client.get(`/admin/billing/tenants/${tenantId}/invoices`).then((r) => r.data),
  payments: (tenantId) => client.get(`/admin/billing/tenants/${tenantId}/payments`).then((r) => r.data),
  recordPayment: (invoiceId, payload) =>
    client.post(`/admin/billing/invoices/${invoiceId}/payments`, payload).then((r) => r.data),
  voidInvoice: (invoiceId, reason) =>
    client.post(`/admin/billing/invoices/${invoiceId}/void`, { reason }).then((r) => r.data),
};

/** Licence keys. */
export const licenseApi = {
  list: () => client.get('/admin/licenses').then((r) => r.data),
  generate: (payload) => client.post('/admin/licenses', payload).then((r) => r.data),
  revoke: (id, reason) => client.post(`/admin/licenses/${id}/revoke`, { reason }).then((r) => r.data),
  activateFor: (key, tenantId) =>
    client.post('/admin/licenses/activate', { key, tenantId }).then((r) => r.data),
  validate: (key) => client.get('/license/validate', { params: { key } }).then((r) => r.data),
};
