import { getNotificationsState, markRead, markAllRead, subscribe } from '../stores/notifications.store.js';
import { formatRelativeTime, formatStatus } from '../utils/formatters.js';

const NOTIFICATION_ICONS = {
  INFO: 'ℹ',
  WARNING: '⚠',
  SUCCESS: '✓',
  ERROR: '✕',
};

let dropdown = null;
let isOpen = false;

export function renderNotificationBell(container) {
  container.className = 'notification-bell';

  const button = document.createElement('button');
  button.className = 'notification-bell-btn';
  button.replaceChildren();
  button.insertAdjacentHTML('beforeend', `
    <svg viewBox="0 0 24 24" width="20" height="20">
      <path fill="currentColor" d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.9 2 2 2zm6-6v-5c0-3.07-1.63-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.64 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z"/>
    </svg>
    <span class="notification-badge">0</span>
  `);

  const dropdownEl = document.createElement('div');
  dropdownEl.className = 'notification-dropdown';
  dropdownEl.style.display = 'none';
  dropdownEl.replaceChildren();
  dropdownEl.insertAdjacentHTML('beforeend', `
    <div class="notification-dropdown-header">
      <span>Notificaciones</span>
      <button class="notification-mark-all-read">Marcar todo como leído</button>
    </div>
    <div class="notification-dropdown-list"></div>
    <div class="notification-dropdown-empty">No hay notificaciones</div>
  `);

  container.appendChild(button);
  container.appendChild(dropdown);
  dropdown = dropdownEl;

  button.addEventListener('click', toggleDropdown);

  const markAllBtn = dropdownEl.querySelector('.notification-mark-all-read');
  markAllBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    markAllRead();
    updateBadge();
    renderList();
  });

  document.addEventListener('click', handleOutsideClick);

  subscribe(() => {
    updateBadge();
    renderList();
  });

  updateBadge();
  renderList();

  return container;
}

function toggleDropdown(e) {
  e.stopPropagation();

  if (isOpen) {
    closeDropdown();
  } else {
    openDropdown();
  }
}

function openDropdown() {
  if (!dropdown) return;

  dropdown.style.display = 'block';
  dropdown.classList.add('dropdown-visible');
  isOpen = true;

  renderList();
}

function closeDropdown() {
  if (!dropdown) return;

  dropdown.classList.remove('dropdown-visible');
  dropdown.classList.add('dropdown-hiding');

  setTimeout(() => {
    dropdown.style.display = 'none';
    dropdown.classList.remove('dropdown-hiding');
    isOpen = false;
  }, 200);
}

function handleOutsideClick(e) {
  if (isOpen && !e.target.closest('.notification-bell')) {
    closeDropdown();
  }
}

function updateBadge() {
  const state = getNotificationsState();
  const bell = document.querySelector('.notification-bell');

  if (!bell) return;

  const badge = bell.querySelector('.notification-badge');

  if (badge) {
    badge.textContent = state.unreadCount;
    badge.style.display = state.unreadCount > 0 ? 'flex' : 'none';
  }
}

function renderList() {
  if (!dropdown) return;

  const state = getNotificationsState();
  const list = dropdown.querySelector('.notification-dropdown-list');
  const empty = dropdown.querySelector('.notification-dropdown-empty');

  if (!list || !empty) return;

  const notifications = state.notifications.slice(0, 5);

  if (notifications.length === 0) {
    list.style.display = 'none';
    empty.style.display = 'block';
    return;
  }

  list.style.display = 'block';
  empty.style.display = 'none';

  list.replaceChildren();
  list.insertAdjacentHTML('beforeend', notifications.map(n => `
    <div class="notification-item ${n.read ? '' : 'unread'}" data-id="${n.id}">
      <span class="notification-item-icon">${NOTIFICATION_ICONS[n.type] || NOTIFICATION_ICONS.INFO}</span>
      <div class="notification-item-content">
        <div class="notification-item-title">${n.title}</div>
        <div class="notification-item-message">${n.message}</div>
        <div class="notification-item-time">${formatRelativeTime(n.createdAt)}</div>
      </div>
    </div>
  `).join(''));

  list.querySelectorAll('.notification-item').forEach(item => {
    item.addEventListener('click', () => {
      const id = item.dataset.id;
      markRead(id);
      updateBadge();
      renderList();

      const notification = state.notifications.find(n => n.id === id);
      if (notification?.link) {
        window.location.href = notification.link;
      }
    });
  });
}

export function createNotificationBell() {
  const container = document.createElement('div');
  return renderNotificationBell(container);
}

export function destroyNotificationBell() {
  document.removeEventListener('click', handleOutsideClick);
  dropdown = null;
  isOpen = false;
}

export default { renderNotificationBell, createNotificationBell, destroyNotificationBell };