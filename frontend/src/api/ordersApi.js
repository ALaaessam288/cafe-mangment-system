import client from './client';

export const ordersApi = {
  /* Orders */
  findAll:   (status) =>
    client.get('/orders', { params: status ? { status } : undefined }).then((r) => r.data),
  findById:  (id)     => client.get(`/orders/${id}`).then((r) => r.data),
  open:      (payload) => client.post('/orders', payload).then((r) => r.data),
  send:      (id)     => client.put(`/orders/${id}/send`).then((r) => r.data),
  serve:     (id)     => client.put(`/orders/${id}/serve`).then((r) => r.data),
  close:     (id)     => client.put(`/orders/${id}/close`).then((r) => r.data),
  voidOrder: (id, payload) => client.put(`/orders/${id}/void`, payload).then((r) => r.data),
  transferTable: (id, payload) => client.put(`/orders/${id}/table`, payload).then((r) => r.data),

  /* Order Items */
  addItem:    (orderId, payload) =>
    client.post(`/orders/${orderId}/items`, payload).then((r) => r.data),
  cancelItem: (orderId, itemId, payload) =>
    client.put(`/orders/${orderId}/items/${itemId}/cancel`, payload).then((r) => r.data),

  /* Payments */
  recordPayment: (orderId, payload) =>
    client.post(`/orders/${orderId}/payments`, payload).then((r) => r.data),
  getPayments: (orderId) =>
    client.get(`/orders/${orderId}/payments`).then((r) => r.data),
};
