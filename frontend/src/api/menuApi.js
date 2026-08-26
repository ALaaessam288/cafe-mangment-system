import client from './client';

export const menuApi = {
  /* Categories */
  getCategories:    ()        => client.get('/categories').then((r) => r.data.map(c => ({...c, name: c.nameAr || c.nameEn}))),
  getCategoryById:  (id)      => client.get(`/categories/${id}`).then((r) => { const c = r.data; return {...c, name: c.nameAr || c.nameEn}; }),
  createCategory:   (payload) => client.post('/categories', { ...payload, nameAr: payload.name }).then((r) => r.data),
  updateCategory:   (id, payload) => client.put(`/categories/${id}`, { ...payload, nameAr: payload.name }).then((r) => r.data),
  deleteCategory:   (id)      => client.delete(`/categories/${id}`).then((r) => r.data),

  /* Products */
  getProducts:     (categoryId) =>
    client.get('/products', { params: categoryId ? { categoryId } : undefined })
      .then((r) => r.data.map(p => ({...p, name: p.nameAr || p.nameEn}))),
  getTopSellers:   () => client.get('/products/top-sellers').then((r) => r.data.map(p => ({...p, name: p.nameAr || p.nameEn}))),
  getProductById:  (id)      => client.get(`/products/${id}`).then((r) => { const p = r.data; return {...p, name: p.nameAr || p.nameEn}; }),
  createProduct:   (payload) => client.post('/products', { ...payload, nameAr: payload.name }).then((r) => r.data),
  updateProduct:   (id, payload) => client.put(`/products/${id}`, { ...payload, nameAr: payload.name }).then((r) => r.data),
  deactivateProduct: (id)    => client.delete(`/products/${id}`).then((r) => r.data),
  activateProduct:   (id)    => client.put(`/products/${id}/activate`).then((r) => r.data),
  setAvailability: (id, available) =>
    client.put(`/products/${id}/availability`, { available }).then((r) => r.data),
  addStock: (id, quantity) => client.put(`/products/${id}/stock`, null, { params: { quantity } }).then((r) => r.data),

  /* Product Options */
  getOptions:    (productId)         => client.get(`/products/${productId}/options`).then((r) => r.data),
  createOption:  (productId, payload) => client.post(`/products/${productId}/options`, payload).then((r) => r.data),
  updateOption:  (productId, optionId, payload) =>
    client.put(`/products/${productId}/options/${optionId}`, payload).then((r) => r.data),
  deleteOption:  (productId, optionId) =>
    client.delete(`/products/${productId}/options/${optionId}`).then((r) => r.data),
};
