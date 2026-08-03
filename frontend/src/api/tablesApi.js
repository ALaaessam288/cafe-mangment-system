import client from './client';

export const tablesApi = {
  findAll:    ()         => client.get('/tables').then((r) => r.data),
  findById:   (id)       => client.get(`/tables/${id}`).then((r) => r.data),
  create:     (payload)  => client.post('/tables', payload).then((r) => r.data),
  update:     (id, payload) => client.put(`/tables/${id}`, payload).then((r) => r.data),
  deactivate: (id)       => client.delete(`/tables/${id}`).then((r) => r.data),
  activate:   (id)       => client.put(`/tables/${id}/activate`).then((r) => r.data),
};
