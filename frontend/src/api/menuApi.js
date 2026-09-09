import client from './client';

/*
 * CategoryRequest on the server is a strict record (nameAr, nameEn, displayOrder) and Jackson is
 * configured to reject unknown fields. Spreading the whole form payload sent the UI-side `name`
 * along with it and every category save came back as a 500. Build the request explicitly instead.
 */
function toCategoryRequest(payload = {}) {
  return {
    nameAr: payload.nameAr ?? payload.name ?? '',
    nameEn: payload.nameEn ?? null,
    displayOrder: Number(payload.displayOrder ?? 0),
  };
}

/* ProductRequest is a strict record too - same failure mode as the category form. */
function toProductRequest(payload = {}) {
  const num = (v) => (v === '' || v === null || v === undefined ? null : Number(v));
  return {
    categoryId: num(payload.categoryId),
    stationId: num(payload.stationId),
    revenueLine: payload.revenueLine ?? null,
    nameAr: payload.nameAr ?? payload.name ?? '',
    nameEn: payload.nameEn ?? null,
    price: num(payload.price),
    prepNote: payload.prepNote ?? null,
    trackInventory: payload.trackInventory ?? false,
    minStockThreshold: num(payload.minStockThreshold),
  };
}

export const menuApi = {
  /* Categories */
  getCategories:    ()        => client.get('/categories').then((r) => r.data.map(c => ({...c, name: c.nameAr || c.nameEn}))),
  getCategoryById:  (id)      => client.get(`/categories/${id}`).then((r) => { const c = r.data; return {...c, name: c.nameAr || c.nameEn}; }),
  createCategory:   (payload) => client.post('/categories', toCategoryRequest(payload)).then((r) => r.data),
  updateCategory:   (id, payload) => client.put(`/categories/${id}`, toCategoryRequest(payload)).then((r) => r.data),
  deleteCategory:   (id)      => client.delete(`/categories/${id}`).then((r) => r.data),
  // The server's DELETE is a soft deactivate; this is how a hidden category comes back.
  activateCategory: (id)      => client.put(`/categories/${id}/activate`).then((r) => r.data),

  /* Products */
  getProducts:     (categoryId) =>
    client.get('/products', { params: categoryId ? { categoryId } : undefined })
      .then((r) => r.data.map(p => ({...p, name: p.nameAr || p.nameEn}))),
  getTopSellers:   () => client.get('/products/top-sellers').then((r) => r.data.map(p => ({...p, name: p.nameAr || p.nameEn}))),
  getProductById:  (id)      => client.get(`/products/${id}`).then((r) => { const p = r.data; return {...p, name: p.nameAr || p.nameEn}; }),
  createProduct:   (payload) => client.post('/products', toProductRequest(payload)).then((r) => r.data),
  updateProduct:   (id, payload) => client.put(`/products/${id}`, toProductRequest(payload)).then((r) => r.data),
  deleteProduct:   (id)          => client.delete(`/products/${id}/permanent`).catch(() => client.delete(`/products/${id}`)).then((r) => r.data),
  deactivateProduct: (id)    => client.delete(`/products/${id}`).then((r) => r.data),
  activateProduct:   (id)    => client.put(`/products/${id}/activate`).then((r) => r.data),
  setAvailability: (id, available) =>
    client.put(`/products/${id}/availability`, { available }).then((r) => r.data),
  addStock: (id, params) => {
    const queryParams = typeof params === 'object' && params !== null ? params : { quantity: params };
    return client.put(`/products/${id}/stock`, null, { params: queryParams }).then((r) => {
      const p = r.data;
      return { ...p, name: p.nameAr || p.nameEn };
    });
  },

  /* Product Options */
  getOptions:    (productId)         => client.get(`/products/${productId}/options`).then((r) => r.data),
  createOption:  (productId, payload) => client.post(`/products/${productId}/options`, payload).then((r) => r.data),
  updateOption:  (productId, optionId, payload) =>
    client.put(`/products/${productId}/options/${optionId}`, payload).then((r) => r.data),
  deleteOption:  (productId, optionId) =>
    client.delete(`/products/${productId}/options/${optionId}`).then((r) => r.data),
};
