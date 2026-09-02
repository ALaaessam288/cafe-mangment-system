import client from './client';

export const ledgerApi = {
  getPnL: (params) => client.get('/ledger/pnl', { params }).then((r) => r.data),
  getCashFlow: (params) => client.get('/ledger/cash-flow', { params }).then((r) => r.data),
  getEntries: (params) => client.get('/ledger/entries', { params }).then((r) => r.data),
};
