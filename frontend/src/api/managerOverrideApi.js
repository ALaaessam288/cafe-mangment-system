import client from './client';

export const managerOverrideApi = {
  verifyOverride: (data) => client.post('/api/manager-overrides/verify', data),
  listAll: () => client.get('/api/manager-overrides'),
  listByShift: (shiftId) => client.get(`/api/manager-overrides/shift/${shiftId}`),
};