import client from './client';

export const registersApi = {
  findAll: () => client.get('/registers').then((r) => r.data),
  create: (payload) => client.post('/registers', payload).then((r) => r.data),
};
