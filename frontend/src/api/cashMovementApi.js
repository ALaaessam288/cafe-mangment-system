import client from './client';

export const cashMovementApi = {
  record: (data) => client.post('/api/cash-movements', data),
  getByShift: (shiftId) => client.get(`/api/cash-movements/shift/${shiftId}`),
  getSummary: (shiftId) => client.get(`/api/cash-movements/shift/${shiftId}/summary`),
};