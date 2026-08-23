import client from './client';

export const employeesApi = {
  findAll: () => client.get('/employees').then((res) => res.data),
  create: (data) => client.post('/employees', data).then((res) => res.data),
  update: (id, data) => client.put(`/employees/${id}`, data).then((res) => res.data),
  delete: (id) => client.delete(`/employees/${id}`).then((res) => res.data),

  // Payroll & Transactions
  createTransaction: (data) => client.post('/employees/transactions', data).then((res) => res.data),
  getTransactions: (employeeId) => client.get(`/employees/${employeeId}/transactions`).then((res) => res.data),
  deleteTransaction: (id) => client.delete(`/employees/transactions/${id}`).then((res) => res.data),
  getPayrollSummary: (startDate, endDate) => client.get('/employees/payroll/summary', { params: { startDate, endDate } }).then((res) => res.data),
  payWeeklySalary: (employeeId, data) => client.post(`/employees/${employeeId}/payroll/payout`, data).then((res) => res.data),
  resetWeek: (data = {}) => client.post('/employees/payroll/reset-week', data).then((res) => res.data),
};
