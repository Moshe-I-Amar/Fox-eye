import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 10000,
});

api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Account-state codes that mean the session is permanently invalid — force logout
const ACCOUNT_STATE_CODES = new Set(['AUTH_PENDING', 'AUTH_REJECTED', 'AUTH_INACTIVE']);

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status;
    const code = error.response?.data?.error?.code;

    if (status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login?reason=session-expired';
      return Promise.reject(error);
    }

    if (status === 403 && ACCOUNT_STATE_CODES.has(code)) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = `/login?reason=${code}`;
      return Promise.reject(error);
    }

    return Promise.reject(error);
  }
);

export default api;