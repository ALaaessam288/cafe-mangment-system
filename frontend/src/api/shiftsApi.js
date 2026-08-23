import client from './client';

export const shiftsApi = {
  open:       (payload) => client.post('/shifts', payload).then((r) => r.data),
  close:      (id, payload) => client.put(`/shifts/${id}/close`, payload).then((r) => r.data),
  forceClose: (id, payload) => client.put(`/shifts/${id}/force-close`, payload).then((r) => r.data),
  myCurrent:  ()        => client.get('/shifts/me/current').then((r) => r.data),
  findById:   (id)      => client.get(`/shifts/${id}`).then((r) => r.data),
  findAll:    (openOnly = false) =>
    client.get('/shifts', { params: { openOnly } }).then((r) => r.data),
  getReport:  (id)      => client.get(`/shifts/${id}/report`).then((r) => r.data),
  setSnacksNet: (id, amount) => client.put(`/shifts/${id}/snacks-net`, { amount }).then((r) => r.data),
  delete:     (id)      => client.delete(`/shifts/${id}`).then((r) => r.data),
};
