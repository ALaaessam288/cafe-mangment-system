import client from './client';

export const auditApi = {
  getAuditItems: () => client.get('/inventory/audit-items').then((r) => r.data),
  saveAuditItem: (dto) => client.post('/inventory/audit-items', dto).then((r) => r.data),
  deleteAuditItem: (id) => client.delete(`/inventory/audit-items/${id}`).then((r) => r.data),

  getProductRecipes: (productId) => client.get(`/inventory/recipes/${productId}`).then((r) => r.data),
  saveProductRecipes: (productId, recipeDtos) => client.post(`/inventory/recipes/${productId}`, recipeDtos).then((r) => r.data),

  recordShiftOpening: (shiftId, openingCounts) => client.post(`/shifts/${shiftId}/opening-audit`, { openingCounts }).then((r) => r.data),
  recordShiftClosing: (shiftId, closingCounts) => client.post(`/shifts/${shiftId}/closing-audit`, { closingCounts }).then((r) => r.data),
  getShiftAuditRecords: (shiftId) => client.get(`/shifts/${shiftId}/audit-records`).then((r) => r.data),
};
