import { io } from 'socket.io-client';

const SOCKET_URL = process.env.EXPO_PUBLIC_SOCKET_URL || 'http://localhost:5000';

let socket = null;
const eventHandlers = new Map();

// Throttle state
let lastLocationSend = 0;
const LOCATION_THROTTLE_MS = 400;

const socketService = {
  connect(token) {
    if (socket?.connected) return;

    socket = io(SOCKET_URL, {
      auth:            { token },
      transports:      ['websocket'],
      reconnection:    true,
      reconnectionAttempts: 5,
      reconnectionDelay:    1000,
      reconnectionDelayMax: 5000,
    });

    socket.on('connect', () => {
      console.log('[socket] connected', socket.id);
      socketService._emit('connect');
    });

    socket.on('disconnect', (reason) => {
      console.log('[socket] disconnected', reason);
      socketService._emit('disconnect', reason);
    });

    socket.on('connect_error', (err) => {
      console.warn('[socket] connect_error', err.message);
      if (err.message?.includes('AUTH') || err.message?.includes('401')) {
        socket.io.opts.reconnection = false;
        socketService._emit('auth_error', err);
      }
      socketService._emit('connect_error', err);
    });

    // Forward all relevant server events to local handlers
    const FORWARDED_EVENTS = [
      'location:update',
      'location:updated',
      'presence:users',
      'presence:user_joined',
      'presence:user_left',
      'presence:update',
      'field:event:new',
      'field:event:acknowledged',
      'field:event:resolved',
      'mobilization:activated',
      'mobilization:status_changed',
      'mobilization:stood_down',
      'ao:breach',
    ];

    FORWARDED_EVENTS.forEach((event) => {
      socket.on(event, (data) => socketService._emit(event, data));
    });
  },

  disconnect() {
    if (socket) {
      socket.disconnect();
      socket = null;
    }
  },

  isConnected() {
    return socket?.connected ?? false;
  },

  updateLocation(coordinates, { heading, speed } = {}) {
    if (!socket?.connected) return;
    const now = Date.now();
    if (now - lastLocationSend < LOCATION_THROTTLE_MS) return;
    lastLocationSend = now;

    socket.emit('location:update', {
      coordinates,
      sessionType: 'MOBILE',
      ...(heading != null && { heading }),
      ...(speed   != null && { speed }),
    });
  },

  on(event, handler) {
    if (!eventHandlers.has(event)) eventHandlers.set(event, new Set());
    eventHandlers.get(event).add(handler);
  },

  off(event, handler) {
    eventHandlers.get(event)?.delete(handler);
  },

  _emit(event, data) {
    eventHandlers.get(event)?.forEach((h) => {
      try { h(data); } catch (err) { console.warn('[socket] handler error', err); }
    });
  },
};

export default socketService;
