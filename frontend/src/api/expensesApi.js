import client from './client';

export const expensesApi = {
  create:   (payload) => client.post('/expenses', payload).then((r) => r.data),
  findAll:  ()        => client.get('/expenses').then((r) => r.data),
  findById: (id)      => client.get(`/expenses/${id}`).then((r) => r.data),
};
