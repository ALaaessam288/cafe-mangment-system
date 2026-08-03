import client from './client';

export const reportsApi = {
  getFinancialReport: () => client.get('/reports/financial').then((res) => res.data),
};
