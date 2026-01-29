import { io } from 'socket.io-client';

class SocketClient {
  constructor() {
    this.socket = null;
    this.isConnected = false;
    this.eventHandlers = new Map();
    this.authFailed = false;
    this.maxReconnectAttempts = 5;
  }

  connect(token) {
    if (this.socket && this.socket.connected) {
      return Promise.resolve(this.socket);
    }

    return new Promise((resolve, reject) => {
      const serverUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';

      this.authFailed = false;
      this.socket = io(serverUrl, {
        auth: { token },
        transports: ['websocket', 'polling'],
        timeout: 20000,
        reconnection: true,
        reconnectionAttempts: this.maxReconnectAttempts,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000
      });

      this.socket.on('connect', () => {
        this.isConnected = true;
        this.emit('connect', { socketId: this.socket.id });
        resolve(this.socket);
      });

      this.socket.on('disconnect', (reason) => {
        this.isConnected = false;
        this.emit('disconnect', { reason });
      });

      this.socket.on('connect_error', (error) => {
        this.isConnected = false;
        if (this.isAuthError(error)) {
          this.handleAuthFailure(error);
          reject(error);
          return;
        }
        this.emit('connect_error', error);
        reject(error);
      });

      this.socket.on('error', (error) => {
        this.emit('error', error);
      });

      this.socket.on('reconnect_attempt', (attempt) => {
        this.emit('reconnecting', { attempt });
      });

      this.socket.io.on('reconnect_failed', () => {
        this.emit('reconnect_failed', { attempts: this.maxReconnectAttempts });
      });

      this.socket.on('location:update', (data) => {
        this.emit('location:update', data);
      });

      this.socket.on('presence:update', (data) => {
        this.emit('presence:update', data);
      });

      this.socket.on('presence:users', (data) => {
        this.emit('presence:users', data);
      });

      this.socket.on('location:response', (data) => {
        this.emit('location:response', data);
      });

      this.socket.on('ao:breach', (data) => {
        this.emit('ao:breach', data);
      });
    });
  }

  disconnect() {
    if (!this.socket) {
      return;
    }
    this.socket.disconnect();
    this.socket = null;
    this.isConnected = false;
    this.eventHandlers.clear();
    this.authFailed = false;
  }

  on(event, handler) {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, new Set());
    }
    this.eventHandlers.get(event).add(handler);
  }

  off(event, handler) {
    if (this.eventHandlers.has(event)) {
      this.eventHandlers.get(event).delete(handler);
    }
  }

  emit(event, data) {
    if (!this.eventHandlers.has(event)) {
      return;
    }
    this.eventHandlers.get(event).forEach((handler) => {
      try {
        handler(data);
      } catch (error) {
        console.error(`Socket handler error for ${event}:`, error);
      }
    });
  }

  isAuthError(error) {
    const message = `${error?.message || error || ''}`.toLowerCase();
    return message.includes('authentication error') || message.includes('token expired') || message.includes('invalid token');
  }

  handleAuthFailure(error) {
    this.authFailed = true;
    if (this.socket?.io?.opts) {
      this.socket.io.opts.reconnection = false;
    }
    if (this.socket?.connected) {
      this.socket.disconnect();
    }
    this.emit('auth_error', {
      message: error?.message || 'Authentication error',
      error
    });
  }

  send(event, data) {
    if (!this.socket || !this.isConnected) {
      throw new Error('Socket not connected');
    }
    this.socket.emit(event, data);
  }

  requestLocation(center, radius = 10, excludeSelf = false) {
    this.send('location:request', { center, radius, excludeSelf });
  }

  updateLocation(coordinates) {
    this.send('location:update', {
      coordinates,
      timestamp: new Date().toISOString()
    });
  }

  subscribeToPresence() {
    this.send('presence:subscribe');
  }

  subscribeToViewport(viewport) {
    this.send('viewport:subscribe', viewport);
  }

  isSocketConnected() {
    return this.isConnected && this.socket?.connected;
  }
}

const socketClient = new SocketClient();

export default socketClient;
