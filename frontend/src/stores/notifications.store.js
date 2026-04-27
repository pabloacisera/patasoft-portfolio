const NOTIFICATIONS_STORAGE_KEY = 'patasoft_notifications';

let notificationsState = {
  notifications: [],
  unreadCount: 0,
};

const listeners = new Set();

function notifyListeners() {
  listeners.forEach(fn => fn(notificationsState));
}

export function getNotificationsState() {
  return { ...notificationsState };
}

export function subscribe(callback) {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

export function loadFromStorage() {
  try {
    const stored = localStorage.getItem(NOTIFICATIONS_STORAGE_KEY);
    if (stored) {
      const data = JSON.parse(stored);
      notificationsState.notifications = data.notifications || [];
      notificationsState.unreadCount = data.unreadCount || 0;
    }
    notifyListeners();
  } catch (error) {
    console.error('Error loading notifications from storage:', error);
  }
}

export function add(notification) {
  const newNotification = {
    id: notification.id || Date.now().toString(),
    title: notification.title,
    message: notification.message,
    type: notification.type || 'INFO',
    read: false,
    createdAt: notification.createdAt || new Date().toISOString(),
    link: notification.link || null,
    data: notification.data || null,
  };

  notificationsState.notifications.unshift(newNotification);
  notificationsState.unreadCount++;

  saveToStorage();
  notifyListeners();

  return newNotification;
}

export function markRead(id) {
  const notification = notificationsState.notifications.find(n => n.id === id);
  if (notification && !notification.read) {
    notification.read = true;
    notificationsState.unreadCount = Math.max(0, notificationsState.unreadCount - 1);
    saveToStorage();
    notifyListeners();
  }
}

export function markAllRead() {
  notificationsState.notifications.forEach(n => {
    n.read = true;
  });
  notificationsState.unreadCount = 0;

  saveToStorage();
  notifyListeners();
}

export function remove(id) {
  const index = notificationsState.notifications.findIndex(n => n.id === id);
  if (index !== -1) {
    const notification = notificationsState.notifications[index];
    if (!notification.read) {
      notificationsState.unreadCount = Math.max(0, notificationsState.unreadCount - 1);
    }
    notificationsState.notifications.splice(index, 1);
    saveToStorage();
    notifyListeners();
  }
}

export function clear() {
  notificationsState.notifications = [];
  notificationsState.unreadCount = 0;

  localStorage.removeItem(NOTIFICATIONS_STORAGE_KEY);
  notifyListeners();
}

export function setNotifications(notifications) {
  notificationsState.notifications = notifications || [];
  notificationsState.unreadCount = (notifications || []).filter(n => !n.read).length;
  saveToStorage();
  notifyListeners();
}

function saveToStorage() {
  localStorage.setItem(NOTIFICATIONS_STORAGE_KEY, JSON.stringify({
    notifications: notificationsState.notifications,
    unreadCount: notificationsState.unreadCount,
  }));
}

export function getUnreadCount() {
  return notificationsState.unreadCount;
}

export function getNotifications() {
  return [...notificationsState.notifications];
}

export function getRecentNotifications(limit = 5) {
  return notificationsState.notifications.slice(0, limit);
}

loadFromStorage();