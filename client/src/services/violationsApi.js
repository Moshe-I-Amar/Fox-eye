import api from './api';

export const violationService = {
  getViolations: async (params = {}) => {
    const query = new URLSearchParams(params).toString();
    const response = await api.get(`/api/violations${query ? `?${query}` : ''}`);
    return response.data.data;
  },

  getViolationById: async (id) => {
    const response = await api.get(`/api/violations/${id}`);
    return response.data.data;
  }
};
