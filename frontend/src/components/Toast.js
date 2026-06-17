const TOAST_TYPES = {
  success: { icon: '✓', class: 'toast-success' },
  error: { icon: '✕', class: 'toast-error' },
  warning: { icon: '!', class: 'toast-warning' },
  info: { icon: 'i', class: 'toast-info' },
};

const toastContainer = createContainer();

function createContainer() {
  let container = document.getElementById('toast-container');
  
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.className = 'toast-container';
    container.setAttribute('aria-live', 'polite');
    document.body.appendChild(container);
  }
  
  return container;
}

function show(options) {
  const { message, type = 'info', duration = 4000, title, onClose, dismissable = true } = options;
  
  const toast = document.createElement('div');
  toast.className = `toast ${TOAST_TYPES[type]?.class || 'toast-info'}`;
  
  const icon = document.createElement('span');
  icon.className = 'toast-icon';
  icon.textContent = TOAST_TYPES[type]?.icon || 'i';
  
  const content = document.createElement('div');
  content.className = 'toast-content';
  
  if (title) {
    const titleEl = document.createElement('div');
    titleEl.className = 'toast-title';
    titleEl.textContent = title;
    content.appendChild(titleEl);
  }
  
  const messageEl = document.createElement('div');
  messageEl.className = 'toast-message';
  messageEl.textContent = message;
  content.appendChild(messageEl);
  
  toast.appendChild(icon);
  toast.appendChild(content);
  
  if (dismissable) {
    const closeBtn = document.createElement('button');
    closeBtn.className = 'toast-close';
    closeBtn.replaceChildren();
    closeBtn.insertAdjacentHTML('beforeend', '&times;');
    closeBtn.addEventListener('click', () => hide(toast));
    toast.appendChild(closeBtn);
  }
  
  toastContainer.appendChild(toast);
  
  requestAnimationFrame(() => {
    toast.classList.add('toast-visible');
  });
  
  if (duration > 0) {
    setTimeout(() => {
      hide(toast);
    }, duration);
  }
  
  return toast;
}

function hide(toast) {
  if (!toast || !toast.parentNode) return;
  
  toast.classList.remove('toast-visible');
  toast.classList.add('toast-hiding');
  
  setTimeout(() => {
    toast.remove();
    
    if (toastContainer.children.length === 0) {
      if (toastContainer.onEmpty) {
        toastContainer.onEmpty();
      }
    }
  }, 300);
}

export function showToast(options) {
  if (typeof options === 'string') {
    return show({ message: options });
  }
  return show(options);
}

export function success(message, options = {}) {
  return show({ message, type: 'success', ...options });
}

export function error(message, options = {}) {
  return show({ message, type: 'error', duration: 6000, ...options });
}

export function warning(message, options = {}) {
  return show({ message, type: 'warning', ...options });
}

export function info(message, options = {}) {
  return show({ message, type: 'info', ...options });
}

export function hideAll() {
  const toasts = toastContainer.querySelectorAll('.toast');
  toasts.forEach(toast => hide(toast));
}

export default { showToast, success, error, warning, info, hideAll };