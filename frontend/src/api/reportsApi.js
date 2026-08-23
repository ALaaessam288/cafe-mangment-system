import client from './client';

export const reportsApi = {
  getFinancialReport: (params) => client.get('/reports/financial', { params }).then((res) => res.data),
};
