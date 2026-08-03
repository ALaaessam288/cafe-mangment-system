import client from './client';

export const usersApi = {
  me:             ()        => client.get('/users/me').then((r) => r.data),
  findAll:        ()        => client.get('/users').then((r) => r.data),
  findById:       (id)      => client.get(`/users/${id}`).then((r) => r.data),
  create:         (payload) => client.post('/users', payload).then((r) => r.data),
  update:         (id, payload) => client.put(`/users/${id}`, payload).then((r) => r.data),
  changePassword: (id, payload) => client.put(`/users/${id}/password`, payload).then((r) => r.data),
  deactivate:     (id)      => client.delete(`/users/${id}`).then((r) => r.data),
  activate:       (id)      => client.put(`/users/${id}/activate`).then((r) => r.data),
};
