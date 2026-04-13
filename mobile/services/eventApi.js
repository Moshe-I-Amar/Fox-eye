import api from './api';

const unwrap = (res) => res.data.data;

export const eventApi = {
  getEvents: (params = {}) =>
    api.get('/api/events', { params }).then(unwrap),

  createEvent: (payload) =>
    api.post('/api/events', payload).then(unwrap),

  acknowledgeEvent: (id) =>
    api.patch(`/api/events/${id}/acknowledge`).then(unwrap),

  resolveEvent: (id) =>
    api.patch(`/api/events/${id}/resolve`).then(unwrap),
};
