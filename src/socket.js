const { Server } = require('socket.io');

let io = null;

function setupSocketIO(httpServer) {
  const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:4000';
  io = new Server(httpServer, {
    cors: {
      origin: function (origin, callback) {
        const allowed = [
          FRONTEND_URL,
          'http://localhost:4000',
          'http://127.0.0.1:4000',
          'http://localhost:3000',
          'http://127.0.0.1:3000',
        ];
        if (!origin || allowed.includes(origin)) {
          callback(null, true);
        } else {
          callback(new Error('CORS no permitido: ' + origin));
        }
      },
      methods: ['GET', 'POST'],
      credentials: true,
    },
    pingTimeout: 60000,
    pingInterval: 25000,
  });

  const storeNS = io.of('/store');
  storeNS.on('connection', (socket) => {
    console.log('[Socket /store] Cliente conectado:', socket.id);
    socket.on('disconnect', () => {
      console.log('[Socket /store] Cliente desconectado:', socket.id);
    });
  });

  const adminNS = io.of('/admin');
  adminNS.on('connection', (socket) => {
    console.log('[Socket /admin] Cliente conectado:', socket.id);
    socket.on('disconnect', () => {
      console.log('[Socket /admin] Cliente desconectado:', socket.id);
    });
  });

  return io;
}

function getIO() {
  return io;
}

const RELAY_TO_STORE = new Set(['products:changed', 'categories:changed', 'carousel:changed']);

function emitStoreEvent(event, data) {
  if (io) io.of('/store').emit(event, data);
}

function emitAdminEvent(event, data) {
  if (io) {
    io.of('/admin').emit(event, data);
    if (RELAY_TO_STORE.has(event)) {
      io.of('/store').emit(event, data);
    }
  }
}

module.exports = { setupSocketIO, getIO, emitStoreEvent, emitAdminEvent };
