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
  /* One date, not a range. Each employee's period is derived from their own anchor and cycle,
     so a single window for everyone could never be right for staff paid on different ones. */
  getPayrollSummary: (on) => client.get('/employees/payroll/summary', { params: { on } }).then((res) => res.data),
  payWeeklySalary: (employeeId, data) => client.post(`/employees/${employeeId}/payroll/payout`, data).then((res) => res.data),
  /* resetWeek is gone. It settled unpaid transactions without paying them, and periods are
     computed now, so there is nothing to reset. */
};
