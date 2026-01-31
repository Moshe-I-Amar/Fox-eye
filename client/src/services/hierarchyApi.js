import api from './api';

export const hierarchyService = {
  getTree: async () => {
    const response = await api.get('/api/hierarchy/tree');
    return response.data.data;
  }
};
