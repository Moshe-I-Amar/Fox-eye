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

export const mobilizationApi = {
  /**
   * Fetch active mobilization(s) for the current user's scope.
   * Returns { mobilizations: MobilizationEvent[] }
   */
  getActive: () => unwrap(api.get('/api/mobilization/active')),

  /**
   * Trigger a new mobilization.
   * @param {object} payload
   * @param {object} payload.targetScope      — { unitId, companyId?, teamId? }
   * @param {string} [payload.incidentDescription]
   * @param {object} [payload.rallyPoint]     — GeoJSON Point { coordinates: [lng, lat] }
   * @param {string} [payload.rallyPointName]
   * Returns { mobilization: MobilizationEvent }
   */
  trigger: (payload) => unwrap(api.post('/api/mobilization', payload)),

  /**
   * Advance the mobilization phase.
   * @param {string} id       — mobilization document _id
   * @param {string} status   — 'TRANSIT' | 'PREPARATION' | 'DEPLOYMENT'
   * Returns { mobilization: MobilizationEvent }
   */
  advanceStatus: (id, status) =>
    unwrap(api.patch(`/api/mobilization/${id}/status`, { status })),

  /**
   * Stand down a mobilization.
   * @param {string} id — mobilization document _id
   * Returns { mobilization: MobilizationEvent }
   */
  standDown: (id) => unwrap(api.patch(`/api/mobilization/${id}/stand-down`)),
};
