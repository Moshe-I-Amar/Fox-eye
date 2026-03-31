import api from './api';

const normalizeError = (error) => {
  const payload = error?.response?.data?.error;
  const status  = error?.response?.status;
  const message = payload?.message || error?.message || 'Request failed';
  const wrapped  = new Error(message);
  wrapped.code    = payload?.code;
  wrapped.status  = status;
  wrapped.details = payload?.details;
  return wrapped;
};

const unwrap = (promise) =>
  promise.then((response) => response.data.data).catch((error) => {
    throw normalizeError(error);
  });

export const eventApi = {
  createEvent:      (payload) => unwrap(api.post('/api/events', payload)),
  getEvents:        (params = {}) => unwrap(api.get('/api/events', { params })),
  acknowledgeEvent: (id) => unwrap(api.patch(`/api/events/${id}/acknowledge`)),
  resolveEvent:     (id) => unwrap(api.patch(`/api/events/${id}/resolve`))
};
