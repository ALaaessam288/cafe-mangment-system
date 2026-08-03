import client from './client';

export const stationsApi = {
  findAll: () => client.get('/stations').then((r) => r.data),
  create: (payload) => client.post('/stations', payload).then((r) => r.data),
};
