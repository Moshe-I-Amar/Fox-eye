import api from './api';

export const authService = {
  register: async (userData) => {
    const response = await api.post('/api/auth/register', userData);
    return response.data.data;
  },

  login: async (credentials) => {
    const response = await api.post('/api/auth/login', credentials);
    return response.data.data;
  },

  getMe: async () => {
    const response = await api.get('/api/auth/me');
    return response.data.data;
  },

  logout: async () => {
    try {
      await api.post('/api/auth/logout');
    } catch (_) {
      // best-effort — clear local state regardless
    }
    localStorage.removeItem('user');
  },

  getCurrentUser: () => {
    const userStr = localStorage.getItem('user');
    if (!userStr) return null;
    try {
      return JSON.parse(userStr);
    } catch (_) {
      localStorage.removeItem('user');
      return null;
    }
  },

  setAuthData: (_token, user) => {
    localStorage.setItem('user', JSON.stringify(user));
  },

  validateInvite: async (token) => {
    const response = await api.get(`/api/auth/invite/${token}`);
    return response.data.data;
  }
};
