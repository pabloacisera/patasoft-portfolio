import { io } from 'socket.io-client';
import { getToken, getAuthState } from '../stores/auth.store.js';
import { add as addNotification } from '../stores/notifications.store.js';
import { showBlockedFullScreen, showBlockedBanner } from '../utils/ui.js';

let socket = null;
const listeners = new Map();

const SOCKET_URL = import.meta.env.VITE_WS_URL || (window.location.hostname === 'localhost'
  ? 'http://localhost:3000'
  : 'https://patasoft-backend.onrender.com');

export function connect(token = null) {
  if (socket?.connected) {
    return socket;
  }

  const authToken = token || getToken();
  
  if (!authToken) {
    console.warn('Cannot connect to socket: no token');
    return null;
  }

  socket = io(SOCKET_URL, {
    auth: { token: authToken },
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,
  });

  socket.on('connect', () => {
    console.log('Socket connected:', socket.id);
  });

  socket.on('disconnect', (reason) => {
    console.log('Socket disconnected:', reason);
  });

  socket.on('connect_error', (error) => {
    console.error('Socket connection error:', error.message);
  });

  socket.on('notification:new', (notification) => {
    addNotification(notification);
    emit('notification:new', notification);
  });

  socket.on('document:ready', (data) => {
    emit('document:ready', data);
  });

  socket.on('stock:alert', (data) => {
    addNotification({
      title: 'Stock bajo',
      message: `El insumo "${data.supplyName}" está bajo de stock`,
      type: 'WARNING',
      data,
    });
    emit('stock:alert', data);
  });

  socket.on('debt:alert', (data) => {
    addNotification({
      title: 'Deuda próxima a vencer',
      message: `La deuda de ${data.clientName} vence el ${data.dueDate}`,
      type: 'WARNING',
      data,
    });
    emit('debt:alert', data);
  });

  socket.on('company:blocked', (data) => {
    const reason = data?.reason || 'Tu suscripción ha vencido.';
    const allowed = ['/settings/subscription', '/settings/export-data'];
    if (allowed.includes(window.location.pathname)) {
      showBlockedBanner(reason);
    } else {
      showBlockedFullScreen(reason);
    }
  });

  return socket;
}

export function disconnect() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
  listeners.clear();
}

export function isConnected() {
  return socket?.connected || false;
}

export function getSocket() {
  return socket;
}

export function on(event, handler) {
  if (!listeners.has(event)) {
    listeners.set(event, new Set());
  }
  listeners.get(event).add(handler);

  return () => {
    const eventListeners = listeners.get(event);
    if (eventListeners) {
      eventListeners.delete(handler);
    }
  };
}

function emit(event, data) {
  const eventListeners = listeners.get(event);
  if (eventListeners) {
    eventListeners.forEach(handler => {
      try {
        handler(data);
      } catch (error) {
        console.error(`Error in socket handler for ${event}:`, error);
      }
    });
  }
}

export function emitEvent(event, data) {
  if (socket?.connected) {
    socket.emit(event, data);
  }
}

export function joinCompanyRoom(companyId) {
  if (socket?.connected) {
    socket.emit('join:company', { companyId });
  }
}

export function leaveCompanyRoom(companyId) {
  if (socket?.connected) {
    socket.emit('leave:company', { companyId });
  }
}

export function subscribeToNotifications(callback) {
  return on('notification:new', callback);
}

export function subscribeToDocumentReady(callback) {
  return on('document:ready', callback);
}

export function subscribeToStockAlerts(callback) {
  return on('stock:alert', callback);
}

export function subscribeToDebtAlerts(callback) {
  return on('debt:alert', callback);
}