import api from './api';

export const aoService = {
  getAOs: async (params = {}) => {
    const query = new URLSearchParams(params).toString();
    const response = await api.get(`/api/aos${query ? `?${query}` : ''}`);
    return response.data.data;
  },

  createAO: async (payload) => {
    const response = await api.post('/api/aos', payload);
    return response.data.data;
  },

  updateAO: async (id, payload) => {
    const response = await api.put(`/api/aos/${id}`, payload);
    return response.data.data;
  },

  setAOActive: async (id, active) => {
    const response = await api.patch(`/api/aos/${id}/active`, { active });
    return response.data.data;
  },

  deleteAO: async (id) => {
    const response = await api.delete(`/api/aos/${id}`);
    return response.data.data;
  }
};
