import axios from 'axios';

// Normalize base URL: strip trailing slashes to prevent double-slash errors
const rawBaseURL =
  import.meta.env.VITE_API_URL ||
  import.meta.env.VITE_BACKEND_URL ||
  (import.meta.env.PROD ? 'https://ibm-hackathon-backend.vercel.app' : '');
const cleanBaseURL = rawBaseURL.trim().replace(/\/+$/, '');

export const API_BASE_URL = cleanBaseURL || (typeof window !== 'undefined' ? window.location.origin : '');

const api = axios.create({
  baseURL: cleanBaseURL,
  timeout: 120000,
  headers: {
    'Accept': 'application/json',
  },
});

// Response interceptor to detect HTML returns (common Vercel rewrite misconfiguration)
api.interceptors.response.use(
  (response) => {
    // If an API endpoint returns HTML string instead of JSON object, Vercel SPA rewrite caught the request
    if (typeof response.data === 'string' && response.data.trim().startsWith('<!DOCTYPE html')) {
      return Promise.reject(
        new Error(
          'API returned HTML instead of JSON. Please verify that VITE_API_URL is configured in your Vercel Project Settings (e.g. https://your-backend.vercel.app).'
        )
      );
    }
    return response;
  },
  (error) => {
    const status = error.response ? error.response.status : 'NETWORK_ERROR';
    const detail = error.response?.data?.detail || error.message;
    console.error(`[API Error] [${status}]:`, detail);
    return Promise.reject(new Error(typeof detail === 'string' ? detail : JSON.stringify(detail)));
  }
);

export const getHealth = () => api.get('/api/health');

export const seedDemoData = () => api.post('/api/seed');

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
