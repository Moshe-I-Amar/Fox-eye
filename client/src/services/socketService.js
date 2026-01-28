import { io } from 'socket.io-client';

class SocketService {
  constructor() {
    this.socket = null;
    this.isConnected = false;
    this.eventHandlers = new Map();
  }

  connect(token) {
    if (this.socket && this.socket.connected) {
      return Promise.resolve(this.socket);
    }

    return new Promise((resolve, reject) => {
      try {
        const serverUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';
        
        this.socket = io(serverUrl, {
          auth: {
            token: token
          },
          transports: ['websocket', 'polling'],
          timeout: 20000,
          reconnection: true,
          reconnectionAttempts: 5,
          reconnectionDelay: 1000
        });

        // Connection events
        this.socket.on('connect', () => {
          console.log('Socket connected successfully');
          this.isConnected = true;
          resolve(this.socket);
        });

        this.socket.on('connected', (data) => {
          console.log('Socket authentication confirmed:', data);
          this.emit('connected', data);
        });

        this.socket.on('disconnect', (reason) => {
          console.log('Socket disconnected:', reason);
          this.isConnected = false;
          this.emit('disconnected', { reason });
        });

        this.socket.on('connect_error', (error) => {
          console.error('Socket connection error:', error);
          this.isConnected = false;
          reject(error);
        });

        this.socket.on('error', (error) => {
          console.error('Socket error:', error);
          this.emit('error', error);
        });

        // Location events
        this.socket.on('location:updated', (data) => {
          this.emit('location:updated', data);
        });

        this.socket.on('location:updated:confirm', (data) => {
          this.emit('location:updated:confirm', data);
        });

        this.socket.on('location:response', (data) => {
          this.emit('location:response', data);
        });

        // Presence events
        this.socket.on('presence:users', (data) => {
          this.emit('presence:users', data);
        });

        this.socket.on('presence:user_joined', (data) => {
          this.emit('presence:user_joined', data);
        });

        this.socket.on('presence:user_left', (data) => {
          this.emit('presence:user_left', data);
        });

        this.socket.on('presence:update', (data) => {
          this.emit('presence:update', data);
        });

        // Admin events
        this.socket.on('admin:location:updated', (data) => {
          this.emit('admin:location:updated', data);
        });

      } catch (error) {
        reject(error);
      }
    });
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.isConnected = false;
    }
  }

  // Event management
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
    if (this.eventHandlers.has(event)) {
      this.eventHandlers.get(event).forEach(handler => {
        try {
          handler(data);
        } catch (error) {
          console.error(`Error in socket event handler for ${event}:`, error);
        }
      });
    }
  }

  // Socket methods
  updateLocation(coordinates) {
    if (!this.socket || !this.isConnected) {
      throw new Error('Socket not connected');
    }

    this.socket.emit('location:update', {
      coordinates,
      timestamp: new Date().toISOString()
    });
  }

  requestLocation(center, radius = 10, excludeSelf = false) {
    if (!this.socket || !this.isConnected) {
      throw new Error('Socket not connected');
    }

    this.socket.emit('location:request', {
      center,
      radius,
      excludeSelf
    });
  }

  subscribeToPresence() {
    if (!this.socket || !this.isConnected) {
      throw new Error('Socket not connected');
    }

    this.socket.emit('presence:subscribe');
  }

  subscribeToViewport(viewport) {
    if (!this.socket || !this.isConnected) {
      throw new Error('Socket not connected');
    }

    this.socket.emit('viewport:subscribe', viewport);
  }

  // Status
  isSocketConnected() {
    return this.isConnected && this.socket?.connected;
  }

  getSocketId() {
    return this.socket?.id;
  }
}

// Singleton instance
const socketService = new SocketService();

export default socketService;
