import api from './api';

const unwrap = (res) => res.data.data;

export const authApi = {
  login: (email, password) =>
    api.post('/api/auth/login', { email, password }).then(unwrap),

  getMe: () =>
    api.get('/api/auth/me').then(unwrap),

  logout: () =>
    api.post('/api/auth/logout'),
};
