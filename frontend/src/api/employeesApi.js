import client from './client';

export const employeesApi = {
  findAll: () => client.get('/employees').then((res) => res.data),
  create: (data) => client.post('/employees', data).then((res) => res.data),
  update: (id, data) => client.put(`/employees/${id}`, data).then((res) => res.data),
  delete: (id) => client.delete(`/employees/${id}`).then((res) => res.data),
};
