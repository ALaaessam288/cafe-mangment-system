import client from './client';

/*
 * Raw-material stock movements.
 *
 * The restock screen used to change a material's balance by POSTing the whole audit item back with
 * a new stockQuantity — so a delivery, a spillage and a typo were indistinguishable afterwards and
 * what the delivery cost was never captured. Every change now goes through the ledger.
 */
export const rawMaterialApi = {
  recordMovement: ({ auditItemId, type, quantity, unitCost = null, reason = null, reference = null, shiftId = null }) =>
    client.post('/inventory/raw-materials/movements', {
      auditItemId, type, quantity, unitCost, reason, reference, shiftId,
    }).then((r) => r.data),

  historyFor: (auditItemId) =>
    client.get(`/inventory/raw-materials/${auditItemId}/movements`).then((r) => r.data),

  ledger: ({ type = null, page = 0, size = 50 } = {}) =>
    client.get('/inventory/raw-materials/movements', {
      params: { ...(type ? { type } : {}), page, size },
    }).then((r) => r.data),
};

export const auditApi = {
  getAuditItems: () => client.get('/inventory/audit-items').then((r) => r.data),
  saveAuditItem: (dto) => client.post('/inventory/audit-items', dto).then((r) => r.data),
  deleteAuditItem: (id) => client.delete(`/inventory/audit-items/${id}`).then((r) => r.data),

  getAllRecipes: () => client.get('/inventory/recipes').then((r) => r.data),
  getProductRecipes: (productId) => client.get(`/inventory/recipes/${productId}`).then((r) => r.data),
  saveProductRecipes: (productId, recipeDtos) => client.post(`/inventory/recipes/${productId}`, recipeDtos).then((r) => r.data),

  recordShiftOpening: (shiftId, openingCounts) => client.post(`/shifts/${shiftId}/opening-audit`, { openingCounts }).then((r) => r.data),
  recordShiftClosing: (shiftId, closingCounts) => client.post(`/shifts/${shiftId}/closing-audit`, { closingCounts }).then((r) => r.data),
  getShiftAuditRecords: (shiftId) => client.get(`/shifts/${shiftId}/audit-records`).then((r) => r.data),
};
