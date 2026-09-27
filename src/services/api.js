import axios from 'axios';

const api = axios.create({
  baseURL: '',
  timeout: 120000,
});

export const getHealth = () => api.get('/api/health');

export const getDashboard = (period) =>
  period ? api.get(`/api/dashboard?period=${period}`) : api.get('/api/dashboard');

export const getMetrics = (period, comparison) => {
  const params = {};
  if (period) params.period = period;
  if (comparison) params.comparison = comparison;
  return api.get('/api/metrics', { params });
};

export const getCategories = (period) =>
  period ? api.get(`/api/categories?period=${period}`) : api.get('/api/categories');

export const getProducts = (period) =>
  period ? api.get(`/api/products?period=${period}`) : api.get('/api/products');

export const getSuppliers = (period) =>
  period ? api.get(`/api/suppliers?period=${period}`) : api.get('/api/suppliers');

export const getTransactions = (params = {}) =>

  api.get('/api/transactions', { params });

export const createTransaction = (payload) =>
  api.post('/api/transactions', payload);

export const deleteTransaction = (id) =>
  api.delete(`/api/transactions/${id}`);

export const batchDeleteTransactions = (ids) =>
  api.post('/api/transactions/batch-delete', { transaction_ids: ids });

export const purgeAllTransactions = () =>
  api.post('/api/transactions/purge');

export const uploadTransactionsCsv = (formData) =>
  api.post('/api/transactions/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });


export const runInvestigation = (payload) =>
  api.post('/api/investigate', payload);

export const getInvestigation = (id) =>
  api.get(`/api/investigations/${id}`);

export const deleteInvestigation = (id) =>
  api.delete(`/api/investigations/${id}`);

export const getInvestigations = () =>
  api.get('/api/investigations');

export const getEvidence = (id) =>
  api.get(`/api/investigations/${id}/evidence`);

export const askInvestigationFollowUp = (id, question) =>
  api.post(`/api/investigations/${id}/ask`, { question });

export default api;

