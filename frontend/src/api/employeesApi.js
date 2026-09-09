import client from './client';

/*
 * EmployeeRequest on the server carries only (name, jobTitle, baseSalary, salaryPeriod, active),
 * and Jackson rejects anything else. The screen was handing it whole EmployeeDto objects - `id`
 * and `createdAt` included - so every edit and every activate/deactivate toggle came back 500.
 */
function toEmployeeRequest(data = {}) {
  const salary = Number(data.baseSalary);
  return {
    name: (data.name ?? '').trim(),
    jobTitle: data.jobTitle ?? null,
    baseSalary: Number.isFinite(salary) ? salary : 0,
    salaryPeriod: data.salaryPeriod ?? 'WEEKLY',
    active: data.active ?? true,
  };
}

export const employeesApi = {
  findAll: () => client.get('/employees').then((res) => res.data),
  create: (data) => client.post('/employees', toEmployeeRequest(data)).then((res) => res.data),
  update: (id, data) => client.put(`/employees/${id}`, toEmployeeRequest(data)).then((res) => res.data),
  delete: (id) => client.delete(`/employees/${id}`).then((res) => res.data),

  // Payroll & Transactions
  createTransaction: (data) => client.post('/employees/transactions', data).then((res) => res.data),
  getTransactions: (employeeId) => client.get(`/employees/${employeeId}/transactions`).then((res) => res.data),
  deleteTransaction: (id) => client.delete(`/employees/transactions/${id}`).then((res) => res.data),
  getPayrollSummary: (startDate, endDate) => client.get('/employees/payroll/summary', { params: { startDate, endDate } }).then((res) => res.data),
  payWeeklySalary: (employeeId, data) => client.post(`/employees/${employeeId}/payroll/payout`, data).then((res) => res.data),
  resetWeek: (data = {}) => client.post('/employees/payroll/reset-week', data).then((res) => res.data),
};
