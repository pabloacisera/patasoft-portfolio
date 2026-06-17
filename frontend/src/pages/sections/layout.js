import { api } from '../../services/api.js';
import { router } from '../../router.js';
import { logout } from '../../stores/auth.store.js';
import { escapeHtml } from '../../utils/escape.js';

const PAGE_TITLES = {
  home: 'Dashboard',
  clients: 'Clientes',
  pets: 'Mascotas',
  'medical-records': 'Historial Médico',
  payments: 'Pagos y Deudas',
  supplies: 'Insumos',
  chat: 'AI Chat',
  connections: 'Conexiones',
  'cash-register': 'Caja',
  settings: 'Configuración',
};

export function renderDashboardLayout(user, currentPage, loadPageFn) {
  const app = document.getElementById('app');
  
  if (!app) return;

  app.replaceChildren();
  app.insertAdjacentHTML('beforeend', `
    <div class="dashboard-layout">
      <a href="#page-content" class="skip-link">Saltar al contenido principal</a>
      <aside class="sidebar">
        <div class="sidebar-logo">PataSoft</div>
        <nav class="sidebar-nav">
          ${getNavItems(currentPage)}
        </nav>
        <div style="flex: 1;"></div>
        <div class="nav-item" data-page="logout">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
          Salir
        </div>
      </aside>
      <div class="main-content">
        <header class="topbar">
          <button class="sidebar-toggle" id="sidebar-toggle" aria-label="Menú">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="3" y1="6" x2="21" y2="6"/>
              <line x1="3" y1="12" x2="21" y2="12"/>
              <line x1="3" y1="18" x2="21" y2="18"/>
            </svg>
          </button>
          <div class="page-title" id="page-title">${PAGE_TITLES[currentPage] || 'Dashboard'}</div>
          <div class="user-menu">
            <span>${escapeHtml(user.name)}</span>
            <div class="user-avatar">${escapeHtml(user.name.charAt(0).toUpperCase())}</div>
          </div>
        </header>
        <main class="page-content" id="page-content" role="status" aria-live="polite"></main>
      </div>
    </div>
  `);

  setupNavListeners(currentPage, loadPageFn);
  setupSidebarToggle();
  checkAndShowTrialBanner();
}

export function getNavItems(currentPage) {
  return `
    <a class="nav-item ${currentPage === 'home' ? 'active' : ''}" data-page="home" href="/dashboard/home">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
      Dashboard
    </a>
    <a class="nav-item ${currentPage === 'clients' ? 'active' : ''}" data-page="clients" href="/dashboard/clients">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
      Clientes
    </a>
    <a class="nav-item ${currentPage === 'pets' ? 'active' : ''}" data-page="pets" href="/dashboard/pets">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2a4 4 0 0 0-4 4v2H6a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-2V6a4 4 0 0 0-4-4z"/></svg>
      Mascotas
    </a>
    <a class="nav-item ${currentPage === 'medical-records' ? 'active' : ''}" data-page="medical-records" href="/dashboard/medical-records">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
      Historial
    </a>
    <a class="nav-item ${currentPage === 'payments' ? 'active' : ''}" data-page="payments" href="/dashboard/payments">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>
      Pagos
    </a>
    <a class="nav-item ${currentPage === 'supplies' ? 'active' : ''}" data-page="supplies" href="/dashboard/supplies">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>
      Insumos
    </a>
    <a class="nav-item ${currentPage === 'chat' ? 'active' : ''}" data-page="chat" href="/dashboard/ai-chat">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
      AI Chat
    </a>
    <a class="nav-item ${currentPage === 'connections' ? 'active' : ''}" data-page="connections" href="/dashboard/connections">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="2"/><path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"/><rect x="9" y="1" width="6" height="12"/></svg>
      Conexiones
    </a>
    <a class="nav-item ${currentPage === 'cash-register' ? 'active' : ''}" data-page="cash-register" href="/dashboard/cash-register">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="4" width="20" height="16" rx="2"/><circle cx="12" cy="12" r="4"/><line x1="2" y1="8" x2="22" y2="8"/></svg>
      Caja
    </a>
    <a class="nav-item ${['settings', 'settings-company', 'settings-subscription', 'settings-mercadopago', 'settings-prices', 'settings-ai', 'settings-connections'].includes(currentPage) ? 'active' : ''}" data-page="settings" href="/settings/company">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
      Configuración
    </a>
  `;
}

export function setupNavListeners(currentPage, loadPageFn) {
  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      const page = item.dataset.page;
      
      if (page === 'logout') {
        logout();
        return;
      }

      currentPage = page;
      
      document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
      item.classList.add('active');
      
      const titleEl = document.getElementById('page-title');
      if (titleEl) titleEl.textContent = PAGE_TITLES[page] || 'Dashboard';
      
      const href = item.getAttribute('href');
      if (href) router.navigate(href);
    });
  });
}

export function setupSidebarToggle() {
  const toggleBtn = document.getElementById('sidebar-toggle');
  const sidebar = document.querySelector('.sidebar');
  if (!toggleBtn || !sidebar) return;
  
  let overlay = document.querySelector('.sidebar-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.className = 'sidebar-overlay';
    document.body.appendChild(overlay);
  }

  toggleBtn.addEventListener('click', () => {
    sidebar.classList.toggle('open');
    overlay.classList.toggle('active');
  });
  
  overlay.addEventListener('click', () => {
    sidebar.classList.remove('open');
    overlay.classList.remove('active');
  });
}

export async function checkAndShowTrialBanner() {
  try {
    const sub = await api.get('/subscriptions/status');
    if (!sub || sub.status !== 'TRIAL') return;
    const now = new Date();
    const trialEnd = sub.trialEndsAt ? new Date(sub.trialEndsAt) : null;
    const hoursLeft = trialEnd ? Math.max(0, Math.ceil((trialEnd - now) / (1000 * 60 * 60))) : 0;
    const daysLeft = Math.floor(hoursLeft / 24);
    const timeText = hoursLeft < 24 ? `${hoursLeft} horas` : `${daysLeft} días`;

    if (sessionStorage.getItem('trial-banner-dismissed')) return;

    const banner = document.createElement('div');
    banner.id = 'trial-global-banner';
    banner.style.cssText = `
      background: linear-gradient(90deg, #f59e0b, #d97706);
      color: white; padding: 10px 20px;
      display: flex; align-items: center; justify-content: space-between;
      font-size: 14px; font-weight: 500; position: relative; z-index: 10;
      border-bottom: 1px solid rgba(0,0,0,0.1);
    `;
    banner.replaceChildren();
    banner.insertAdjacentHTML('beforeend', `
      <div style="display:flex;align-items:center;gap:8px;">
        <span>⏳</span>
        <span>Período de prueba gratuita (72 horas) — Te quedan ${timeText} de acceso completo.</span>
        <button
          onclick="window._router && window._router.navigate('/settings/subscription')"
          style="background:white;color:#d97706;border:none;padding:4px 12px;border-radius:6px;font-size:13px;font-weight:600;cursor:pointer;margin-left:8px;"
        >
          Ver planes →
        </button>
      </div>
      <span style="cursor:pointer;font-size:18px;line-height:1;padding:4px;" id="dismiss-trial-banner">✕</span>
    `);
    const mainContent = document.querySelector('.main-content');
    if (mainContent) mainContent.insertBefore(banner, mainContent.firstChild);
    
    document.getElementById('dismiss-trial-banner')?.addEventListener('click', () => {
      banner.remove();
      sessionStorage.setItem('trial-banner-dismissed', 'true');
    });
  } catch (e) {
    // No bloquear el dashboard si falla
  }
}
