import client from './client';

export const debtsApi = {
  findAll: ()           => client.get('/debts').then((r) => r.data),
  create:  (payload)    => client.post('/debts', payload).then((r) => r.data),
  settle:  (id, payload) => client.put(`/debts/${id}/settle`, payload).then((r) => r.data),
  delete:  (id)          => client.delete(`/debts/${id}`).then((r) => r.data),
};