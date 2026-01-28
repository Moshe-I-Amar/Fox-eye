import api from './api';

export const userService = {
  getAllUsers: async (page = 1, limit = 10) => {
    const response = await api.get(`/api/users?page=${page}&limit=${limit}`);
    return response.data;
  },

  getUserById: async (id) => {
    const response = await api.get(`/api/users/${id}`);
    return response.data;
  },

  getUsersNearby: async (lat, lng, distance = 10) => {
    const response = await api.get(`/api/users/near?lat=${lat}&lng=${lng}&distance=${distance}`);
    return response.data;
  },

  updateMyLocation: async (coordinates) => {
    const response = await api.put('/api/users/me/location', { coordinates });
    return response.data;
  }
};