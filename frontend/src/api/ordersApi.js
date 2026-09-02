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
  refund: (id, payload) => client.post(`/orders/${id}/refund`, payload).then((r) => r.data),
  transferTable: (id, payload) => client.put(`/orders/${id}/table`, payload).then((r) => r.data),
  setDeliveryFee: (id, amount) => client.put(`/orders/${id}/delivery-fee`, { amount }).then((r) => r.data),
  setServiceFee: (id, amount) => client.put(`/orders/${id}/service-fee`, { amount }).then((r) => r.data),
  clearServiceFee: (id) => client.delete(`/orders/${id}/service-fee`).then((r) => r.data),
  applyDiscount: (id, payload) => client.post(`/orders/${id}/discounts`, payload).then((r) => r.data),
  clearDiscount: (id) => client.delete(`/orders/${id}/discounts`).then((r) => r.data),

  /* Order Items */
  addItem:    (orderId, payload) =>
    client.post(`/orders/${orderId}/items`, payload).then((r) => r.data),
  cancelItem: (orderId, itemId, payload) =>
    client.put(`/orders/${orderId}/items/${itemId}/cancel`, payload).then((r) => r.data),
  /* Deletes a line the kitchen has never seen. Only valid while the item is still NEW - a sent
     item has to be cancelled instead, which is an audited action with a reason and a slip. */
  removeItem: (orderId, itemId) =>
    client.delete(`/orders/${orderId}/items/${itemId}`).then((r) => r.data),

  /* Payments */
  checkout: (orderId, payload, idempotencyKey) =>
    client.post(`/orders/${orderId}/checkout`, payload, {
      headers: idempotencyKey ? { 'X-Idempotency-Key': idempotencyKey } : {}
    }).then((r) => r.data),
  recordPayment: (orderId, payload) =>
    client.post(`/orders/${orderId}/payments`, payload).then((r) => r.data),
  getPayments: (orderId) =>
    client.get(`/orders/${orderId}/payments`).then((r) => r.data),
};
