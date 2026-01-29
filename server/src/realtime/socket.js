const { Server } = require('socket.io');
const { authenticateSocket } = require('../middleware/socketAuth');
const SocketService = require('../services/socketService');

let socketService = null;
let ioServer = null;

const initSocket = (server) => {
  const io = new Server(server, {
    cors: {
      origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
      methods: ['GET', 'POST'],
      credentials: true
    },
    transports: ['websocket', 'polling']
  });

  // Add authentication middleware
  io.use(authenticateSocket);

  // Initialize socket service
  ioServer = io;
  socketService = new SocketService(io);

  console.log('Socket.IO server initialized with JWT authentication');

  return { io, socketService };
};

const getIO = () => {
  if (!socketService || !ioServer) {
    throw new Error('Socket.io has not been initialized. Call initSocket(server) first.');
  }
  return ioServer;
};

const getSocketService = () => {
  if (!socketService) {
    throw new Error('Socket.io has not been initialized. Call initSocket(server) first.');
  }
  return socketService;
};

const closeSocket = async () => {
  if (!ioServer) {
    return;
  }

  await new Promise((resolve) => ioServer.close(resolve));
  ioServer = null;
  socketService = null;
  console.log('Socket.IO server closed');
};

module.exports = {
  initSocket,
  getIO,
  getSocketService,
  closeSocket
};
