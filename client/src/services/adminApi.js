import api from './api';

const normalizeError = (error) => {
  const payload = error?.response?.data?.error;
  const status = error?.response?.status;
  const message = payload?.message || error?.message || 'Request failed';
  const wrapped = new Error(message);
  wrapped.code = payload?.code;
  wrapped.status = status;
  wrapped.details = payload?.details;
  return wrapped;
};

const unwrap = (promise) =>
  promise.then((response) => response.data.data).catch((error) => {
    throw normalizeError(error);
  });

export const adminApi = {
  getHierarchyTree: () => unwrap(api.get('/api/admin/hierarchy/tree')),

  createCompany: (payload) => unwrap(api.post('/api/admin/companies', payload)),
  updateCompany: (id, payload) => unwrap(api.put(`/api/admin/companies/${id}`, payload)),
  deactivateCompany: (id) => unwrap(api.delete(`/api/admin/companies/${id}`)),

  createTeam: (payload) => unwrap(api.post('/api/admin/teams', payload)),
  updateTeam: (id, payload) => unwrap(api.put(`/api/admin/teams/${id}`, payload)),
  deactivateTeam: (id) => unwrap(api.delete(`/api/admin/teams/${id}`)),

  createSquad: (payload) => unwrap(api.post('/api/admin/squads', payload)),
  updateSquad: (id, payload) => unwrap(api.put(`/api/admin/squads/${id}`, payload)),
  deactivateSquad: (id) => unwrap(api.delete(`/api/admin/squads/${id}`)),

  createUser: (payload) => unwrap(api.post('/api/admin/users', payload)),
  updateUser: (id, payload) => unwrap(api.put(`/api/admin/users/${id}`, payload)),
  setUserActive: (id, active) => unwrap(api.patch(`/api/admin/users/${id}/active`, { active })),

  getUsers: (page = 1, limit = 10) =>
    unwrap(api.get(`/api/users?page=${page}&limit=${limit}`))
};
