import api from './api';

const unwrap = (res) => res.data.data;

export const mobilizationApi = {
  getActive: () =>
    api.get('/api/mobilization/active').then(unwrap),

  trigger: (payload) =>
    api.post('/api/mobilization', payload).then(unwrap),

  advanceStatus: (id, status) =>
    api.patch(`/api/mobilization/${id}/status`, { status }).then(unwrap),

  standDown: (id) =>
    api.patch(`/api/mobilization/${id}/stand-down`).then(unwrap),
};
