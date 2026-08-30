import client from './client';

export const reportsApi = {
  getFinancialReport: (params) => client.get('/reports/financial', { params }).then((res) => res.data),
  getBestSellers: (params) => client.get('/reports/bestsellers', { params }).then((res) => res.data),
  getHourlySales: (params) => client.get('/reports/hourly', { params }).then((res) => res.data),
};
