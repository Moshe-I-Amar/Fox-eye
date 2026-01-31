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

  logout: () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  },

  isAuthenticated: () => {
    return !!localStorage.getItem('token');
  },

  getCurrentUser: () => {
    const userStr = localStorage.getItem('user');
    if (!userStr) {
      return null;
    }
    try {
      return JSON.parse(userStr);
    } catch (error) {
      localStorage.removeItem('user');
      return null;
    }
  },

  setAuthData: (token, user) => {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(user));
  }
};
