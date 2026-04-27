import { api } from '../services/api.js';
import { router } from '../router.js';
import { logout, getCompany, getUser, getToken, isAuthenticated } from '../stores/auth.store.js';
import { formatCurrency, formatDate, formatDateTime, formatStatus, formatSpecies, formatGender } from '../utils/formatters.js';
import { validateRequired, validateEmail, validateDNI, showFieldError, clearFieldErrors } from '../utils/validators.js';
import { createSearchBar } from '../components/SearchBar.js';
import { createPagination } from '../components/Pagination.js';
import { openModal, closeModal } from '../components/Modal.js';
import { showToast } from '../components/Toast.js';

let currentPage = 'home';
let pageData = {};

export async function renderDashboard() {
  const app = document.getElementById('app');
  
  console.log('[Dashboard] Render - isAuthenticated:', isAuthenticated());
  console.log('[Dashboard] Render - token existe:', !!getToken());
  console.log('[Dashboard] Render - token:', getToken() ? getToken().substring(0, 20) + '...' : null);
  
  try {
    const user = await api.get('/auth/me');
    console.log('[Dashboard] /auth/me response:', user);
    
    if (!user) {
      console.warn('[Dashboard] No user data, redirigiendo a login');
      router.navigate('/login');
      return;
    }
    
    if (!user.companyId) {
      console.warn('[Dashboard] Usuario sin company, redirigiendo a onboarding');
      router.navigate('/onboarding');
      return;
    }
    
    user.company = user.company;
    renderDashboardLayout(user);
  } catch (e) {
    console.error('[Dashboard] Error fetching /auth/me:', e);
    router.navigate('/login');
  }
}

export async function renderDashboardHome() {
  currentPage = 'home';
  
  if (!document.getElementById('page-content')) {
    try {
      const user = await api.get('/auth/me');
      if (!user || !user.companyId) {
        router.navigate('/onboarding');
        return;
      }
      renderDashboardLayout(user);
    } catch (e) {
      console.error('[Dashboard] Error en renderDashboardHome:', e);
      router.navigate('/login');
      return;
    }
  }
  
  await loadHomeData();
  return renderDashboardPage('home');
}

export async function renderClients() {
  currentPage = 'clients';
  pageData.clients = pageData.clients || { page: 1, search: '' };
  
  if (!document.getElementById('page-content')) {
    try {
      const user = await api.get('/auth/me');
      if (!user || !user.companyId) {
        router.navigate('/onboarding');
        return;
      }
      renderDashboardLayout(user);
    } catch (e) {
      router.navigate('/login');
      return;
    }
  }
  
  await loadClientsData(pageData.clients.page, pageData.clients.search);
  return renderDashboardPage('clients');
}

export async function renderPets() {
  currentPage = 'pets';
  pageData.pets = pageData.pets || { page: 1, search: '' };
  
  if (!document.getElementById('page-content')) {
    try {
      const user = await api.get('/auth/me');
      if (!user || !user.companyId) {
        router.navigate('/onboarding');
        return;
      }
      renderDashboardLayout(user);
    } catch (e) {
      router.navigate('/login');
      return;
    }
  }
  
  await loadPetsData(pageData.pets.page, pageData.pets.search);
  return renderDashboardPage('pets');
}

export async function renderMedicalRecords() {
  currentPage = 'medical-records';
  pageData.medicalRecords = pageData.medicalRecords || { page: 1, petId: '' };
  
  if (!document.getElementById('page-content')) {
    try {
      const user = await api.get('/auth/me');
      if (!user || !user.companyId) {
        router.navigate('/onboarding');
        return;
      }
      renderDashboardLayout(user);
    } catch (e) {
      router.navigate('/login');
      return;
    }
  }
  
  await loadMedicalRecordsData(pageData.medicalRecords.page, pageData.medicalRecords.petId);
  return renderDashboardPage('medical-records');
}

export async function renderPayments() {
  currentPage = 'payments';
  pageData.payments = pageData.payments || { page: 1, status: '' };
  pageData.debts = pageData.debts || { page: 1, status: '' };
  
  if (!document.getElementById('page-content')) {
    try {
      const user = await api.get('/auth/me');
      if (!user || !user.companyId) {
        router.navigate('/onboarding');
        return;
      }
      renderDashboardLayout(user);
    } catch (e) {
      router.navigate('/login');
      return;
    }
  }
  
  await Promise.all([
    loadPaymentsData(pageData.payments.page, pageData.payments.status),
    loadDebtsData(pageData.debts.page, pageData.debts.status),
  ]);
  return renderDashboardPage('payments');
}

export async function renderSupplies() {
  currentPage = 'supplies';
  pageData.supplies = pageData.supplies || { page: 1, search: '' };
  
  if (!document.getElementById('page-content')) {
    try {
      const user = await api.get('/auth/me');
      if (!user || !user.companyId) {
        router.navigate('/onboarding');
        return;
      }
      renderDashboardLayout(user);
    } catch (e) {
      router.navigate('/login');
      return;
    }
  }
  
  await loadSuppliesData(pageData.supplies.page, pageData.supplies.search);
  return renderDashboardPage('supplies');
}

export async function renderAIChat() {
  currentPage = 'chat';
  
  if (!document.getElementById('page-content')) {
    try {
      const user = await api.get('/auth/me');
      if (!user || !user.companyId) {
        router.navigate('/onboarding');
        return;
      }
      renderDashboardLayout(user);
    } catch (e) {
      router.navigate('/login');
      return;
    }
  }
  
  return renderDashboardPage('chat');
}

export async function renderConnections() {
  currentPage = 'connections';
  pageData.connections = pageData.connections || { page: 1, status: '' };
  
  if (!document.getElementById('page-content')) {
    try {
      const user = await api.get('/auth/me');
      if (!user || !user.companyId) {
        router.navigate('/onboarding');
        return;
      }
      renderDashboardLayout(user);
    } catch (e) {
      router.navigate('/login');
      return;
    }
  }
  
  await loadConnectionsData(pageData.connections.page, pageData.connections.status);
  return renderDashboardPage('connections');
}

export async function renderDocuments() {
  currentPage = 'documents';
  return renderDashboardPage('documents');
}

export async function renderSettings() {
  currentPage = 'settings';
  return renderSettingsPage('company');
}

export async function renderSettingsCompany() {
  return renderSettingsPage('company');
}

export async function renderSettingsSubscription() {
  return renderSettingsPage('subscription');
}

export async function renderSettingsMercadoPago() {
  return renderSettingsPage('mercadopago');
}

export async function renderSettingsPrices() {
  currentPage = 'settings-prices';
  pageData.priceItems = pageData.priceItems || { page: 1, search: '' };
  await loadPriceItemsData(pageData.priceItems.page, pageData.priceItems.search);
  return renderSettingsPage('prices');
}

export async function renderSettingsAI() {
  return renderSettingsPage('ai');
}

export async function renderSettingsConnections() {
  currentPage = 'settings-connections';
  pageData.settingsConnections = pageData.settingsConnections || { page: 1 };
  await loadConnectionsData(pageData.settingsConnections.page, '');
  return renderSettingsPage('connections');
}

function renderDashboardLayout(user) {
  const app = document.getElementById('app');
  
  if (!app) return;

  app.innerHTML = `
    <div class="dashboard-layout">
      <aside class="sidebar">
        <div class="sidebar-logo">PataSoft</div>
        <nav class="sidebar-nav">
          ${getNavItems()}
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
          <div class="page-title" id="page-title">Dashboard</div>
          <div class="user-menu">
            <span>${user.name}</span>
            <div class="user-avatar">${user.name.charAt(0).toUpperCase()}</div>
          </div>
        </header>
        <main class="page-content" id="page-content"></main>
      </div>
    </div>
  `;

  setupNavListeners();
  setupSidebarToggle();
  checkAndShowTrialBanner();
}

function getNavItems() {
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
    <a class="nav-item ${['settings', 'settings-company', 'settings-subscription', 'settings-mercadopago', 'settings-prices', 'settings-ai', 'settings-connections'].includes(currentPage) ? 'active' : ''}" data-page="settings" href="/settings/company">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
      Configuración
    </a>
  `;
}

function setupNavListeners() {
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
      const titles = {
        home: 'Dashboard', clients: 'Clientes', pets: 'Mascotas',
        'medical-records': 'Historial Médico', payments: 'Pagos y Deudas',
        supplies: 'Insumos', chat: 'AI Chat', connections: 'Conexiones',
        settings: 'Configuración',
      };
      if (titleEl) titleEl.textContent = titles[page] || 'Dashboard';
      
      loadPage(page);
    });
  });
}

function setupSidebarToggle() {
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

async function checkAndShowTrialBanner() {
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
      font-size: 14px; font-weight: 500; position: sticky; top: 0; z-index: 100;
    `;
    banner.innerHTML = `
      <div>
        ⏳ Período de prueba gratuita (72 horas) — Te quedan ${timeText} de acceso completo.
        <a href="/settings/subscription" style="color: white; text-decoration: underline; margin-left: 8px;">Suscribite ahora →</a>
      </div>
      <span style="cursor: pointer; font-size: 18px;" id="dismiss-trial-banner">✕</span>
    `;
    const mainContent = document.querySelector('.main-content');
    if (mainContent) mainContent.parentNode.insertBefore(banner, mainContent);
    
    document.getElementById('dismiss-trial-banner')?.addEventListener('click', () => {
      banner.remove();
      sessionStorage.setItem('trial-banner-dismissed', 'true');
    });
  } catch (e) {
    // No bloquear el dashboard si falla
  }
}

async function loadPage(page) {
  const content = document.getElementById('page-content');
  if (!content) return;
  
  switch (page) {
    case 'home': await renderDashboardPage('home'); break;
    case 'clients': await renderClients(); break;
    case 'pets': await renderPets(); break;
    case 'medical-records': await renderMedicalRecords(); break;
    case 'payments': await renderPayments(); break;
    case 'supplies': await renderSupplies(); break;
    case 'chat': await renderDashboardPage('chat'); break;
    case 'connections': await renderConnections(); break;
  }
}

async function loadHomeData() {
  try {
    const [clients, pets, debts, supplies, subStatus] = await Promise.all([
      api.get('/clients').catch(() => ({ data: [], meta: { total: 0 } })),
      api.get('/pets').catch(() => ({ data: [], meta: { total: 0 } })),
      api.get('/debts?status=PENDING').catch(() => ({ data: [] })),
      api.get('/supplies/low-stock').catch(() => ({ data: [] })),
      api.get('/subscriptions/status').catch(() => null),
    ]);
    
    const totalDebt = (debts.data || []).reduce((sum, d) => sum + (d.amount || 0), 0);
    
    pageData.home = { clients, pets, totalDebt, lowStockCount: supplies.data?.length || 0, medicalRecords: pets.data || [], subStatus };
  } catch (e) {
    console.error('Error loading home data:', e);
  }
}

async function renderDashboardPage(page) {
  const content = document.getElementById('page-content');
  if (!content) return;
  
  switch (page) {
    case 'home': await renderHomePage(content); break;
    case 'clients': await renderClientsPage(content); break;
    case 'pets': await renderPetsPage(content); break;
    case 'medical-records': await renderMedicalRecordsPage(content); break;
    case 'payments': await renderPaymentsPage(content); break;
    case 'supplies': await renderSuppliesPage(content); break;
    case 'chat': await renderChatPage(content); break;
    case 'connections': await renderConnectionsPage(content); break;
  }
}

async function renderHomePage(content) {
  const data = pageData.home || {};
  const clientsCount = data.clients?.meta?.total || data.clients?.data?.length || 0;
  const petsCount = data.pets?.meta?.total || data.pets?.data?.length || 0;
  const totalDebt = data.totalDebt || 0;
  const lowStockCount = data.lowStockCount || 0;
  const sub = data.subStatus;
  
  const isTrial = sub?.status === 'TRIAL';
  const isExpired = ['EXPIRED', 'BLOCKED', 'CANCELLED'].includes(sub?.status);
  const subBadge = isTrial ? 'badge-trial' : isExpired ? 'badge-expired' : 'badge-active';
  const subText = isTrial ? '⏳ Prueba gratuita' : isExpired ? '🔒 Vencida' : '✅ Activa';
  const subLink = isExpired || isTrial;
  
  content.innerHTML = `
    ${sub ? `
    <div class="subscription-card" style="background: var(--surface); border: 1.5px solid var(--border); border-radius: var(--radius-xl); padding: var(--space-4); margin-bottom: var(--space-6); display: flex; align-items: center; justify-content: space-between;">
      <div>
        <span class="subscription-badge ${subBadge}" style="display: inline-flex; align-items: center; gap: var(--space-2); padding: var(--space-1) var(--space-3); border-radius: var(--radius-full); font-size: var(--text-sm); font-weight: 600;">
          ${subText}
        </span>
        <span style="margin-left: var(--space-3); font-size: var(--text-sm); color: var(--text-secondary);">
          ${sub?.plan ? `Plan ${sub.plan === 'MONTHLY' ? 'Mensual' : 'Anual'}` : ''}
        </span>
      </div>
      ${subLink ? `<a href="/settings/subscription" class="btn btn-primary btn-sm">Ver planes</a>` : ''}
    </div>
    ` : ''}
    <div class="stats-grid">
      <div class="stat-card" onclick="window.location.href='/dashboard/clients'" style="cursor:pointer">
        <div class="stat-value">${clientsCount}</div>
        <div class="stat-label">Clientes</div>
      </div>
      <div class="stat-card" onclick="window.location.href='/dashboard/pets'" style="cursor:pointer">
        <div class="stat-value">${petsCount}</div>
        <div class="stat-label">Mascotas</div>
      </div>
      <div class="stat-card" onclick="window.location.href='/dashboard/payments'" style="cursor:pointer">
        <div class="stat-value">${formatCurrency(totalDebt)}</div>
        <div class="stat-label">Deuda Total</div>
      </div>
      <div class="stat-card" onclick="window.location.href='/dashboard/supplies'" style="cursor:pointer">
        <div class="stat-value">${lowStockCount}</div>
        <div class="stat-label">Insumos Bajos</div>
      </div>
    </div>
    
    <div style="margin-top: 24px;">
      <h3 style="margin-bottom: 16px;">Últimas Consultas</h3>
      <div class="empty-state" id="recent-records">
        <p>Cargando...</p>
      </div>
    </div>
  `;
  
  try {
    const { data: records } = await api.get('/medical-records?page=1&limit=5');
    const recordsEl = document.getElementById('recent-records');
    
    if (records?.length) {
      recordsEl.innerHTML = `
        <table class="data-table">
          <thead><tr><th>Fecha</th><th>Mascota</th><th>Motivo</th><th>Diagnóstico</th></tr></thead>
          <tbody>${records.map(r => `
            <tr>
              <td>${formatDate(r.date)}</td>
              <td>${r.pet?.name || '-'}</td>
              <td>${r.visitReason}</td>
              <td>${r.diagnosis || '-'}</td>
            </tr>
          `).join('')}</tbody>
        </table>
      `;
    } else {
      recordsEl.innerHTML = '<p class="empty-state">No hay consultas recientes</p>';
    }
  } catch (e) {
    document.getElementById('recent-records').innerHTML = '<p class="empty-state">Error cargando datos</p>';
  }
}

async function loadClientsData(page = 1, search = '') {
  try {
    const params = { page, limit: 20 };
    if (search) params.search = search;
    
    const result = await api.get('/clients', params);
    pageData.clients = { ...result, page, search };
  } catch (e) {
    pageData.clients = { data: [], meta: { total: 0 }, page, search };
  }
}

async function renderClientsPage(content) {
  const data = pageData.clients || { data: [], meta: { total: 0 } };
  
  content.innerHTML = `
    <div class="page-header">
      <div id="search-clients"></div>
      <button class="btn btn-primary" id="add-client-btn">Nuevo Cliente</button>
    </div>
    <div id="clients-list"></div>
    <div id="clients-pagination"></div>
  `;
  
  const searchBar = createSearchBar({
    placeholder: 'Buscar clientes...',
    initialValue: data.search || '',
    onSearch: async (query) => {
      pageData.clients.search = query;
      await loadClientsData(1, query);
      renderClientsPage(document.getElementById('page-content'));
    }
  });
  document.getElementById('search-clients').appendChild(searchBar);
  
  const listEl = document.getElementById('clients-list');
  if (data.data?.length) {
    listEl.innerHTML = `
      <table class="data-table">
        <thead><tr><th>Nombre</th><th>Email</th><th>Teléfono</th><th>Acciones</th></tr></thead>
        <tbody>${data.data.map(c => `
          <tr>
            <td>${c.name} ${c.lastName || ''}</td>
            <td>${c.email || '-'}</td>
            <td>${c.phone || '-'}</td>
            <td><button class="btn btn-outline btn-sm" data-id="${c.id}" data-action="view">Ver</button></td>
          </tr>
        `).join('')}</tbody>
      </table>
    `;
    
    listEl.querySelectorAll('[data-action="view"]').forEach(btn => {
      btn.addEventListener('click', () => showClientDetail(btn.dataset.id));
    });
  } else {
    listEl.innerHTML = '<div class="empty-state"><p>No hay clientes</p></div>';
  }
  
  const paginationEl = document.getElementById('clients-pagination');
  if (data.meta?.total > 20) {
    const pagination = createPagination({
      total: data.meta.total,
      page: data.page,
      limit: 20,
      onPageChange: async (newPage) => {
        await loadClientsData(newPage, data.search);
        renderClientsPage(document.getElementById('page-content'));
      }
    });
    paginationEl.appendChild(pagination);
  }
  
  document.getElementById('add-client-btn')?.addEventListener('click', showAddClientModal);
}

function showClientDetail(clientId) {
  const client = pageData.clients?.data?.find(c => c.id === clientId);
  if (!client) return;
  
  openModal({
    title: `Cliente: ${client.name} ${client.lastName || ''}`,
    content: `
      <div class="detail-row"><span>DNI:</span><span>${client.dni || '-'}</span></div>
      <div class="detail-row"><span>Email:</span><span>${client.email || '-'}</span></div>
      <div class="detail-row"><span>Teléfono:</span><span>${client.phone || '-'}</span></div>
      <div class="detail-row"><span>Dirección:</span><span>${client.address || '-'}</span></div>
    `,
    showCancel: false,
    confirmText: 'Cerrar',
  });
}

function showAddClientModal() {
  openModal({
    title: 'Nuevo Cliente',
    content: `
      <div class="form-group">
        <label class="form-label required">Nombre</label>
        <input type="text" class="form-input" id="client-name">
      </div>
      <div class="form-group">
        <label class="form-label">Apellido</label>
        <input type="text" class="form-input" id="client-lastName">
      </div>
      <div class="form-group">
        <label class="form-label">DNI</label>
        <input type="text" class="form-input" id="client-dni">
      </div>
      <div class="form-group">
        <label class="form-label">Email</label>
        <input type="email" class="form-input" id="client-email">
      </div>
      <div class="form-group">
        <label class="form-label">Teléfono</label>
        <input type="tel" class="form-input" id="client-phone">
      </div>
      <div class="form-group">
        <label class="form-label">Dirección</label>
        <input type="text" class="form-input" id="client-address">
      </div>
    `,
    onConfirm: async () => {
      const name = document.getElementById('client-name').value.trim();
      if (!name) {
        showFieldError('client-name', 'El nombre es requerido');
        return false;
      }
      
      try {
        await api.post('/clients', {
          name,
          lastName: document.getElementById('client-lastName').value.trim(),
          dni: document.getElementById('client-dni').value.trim(),
          email: document.getElementById('client-email').value.trim(),
          phone: document.getElementById('client-phone').value.trim(),
          address: document.getElementById('client-address').value.trim(),
        });
        
        showToast('Cliente creado', 'success');
        await loadClientsData(1, pageData.clients?.search || '');
        renderClientsPage(document.getElementById('page-content'));
      } catch (e) {
        showToast(e.message || 'Error creando cliente', 'error');
        return false;
      }
    }
  });
}

async function loadPetsData(page = 1, search = '') {
  try {
    const params = { page, limit: 20 };
    if (search) params.search = search;
    
    const result = await api.get('/pets', params);
    pageData.pets = { ...result, page, search };
  } catch (e) {
    pageData.pets = { data: [], meta: { total: 0 }, page, search };
  }
}

async function renderPetsPage(content) {
  const data = pageData.pets || { data: [], meta: { total: 0 } };
  
  content.innerHTML = `
    <div class="page-header">
      <div id="search-pets"></div>
      <button class="btn btn-primary" id="add-pet-btn">Nueva Mascota</button>
    </div>
    <div id="pets-list"></div>
    <div id="pets-pagination"></div>
  `;
  
  const searchBar = createSearchBar({
    placeholder: 'Buscar mascotas...',
    initialValue: data.search || '',
    onSearch: async (query) => {
      pageData.pets.search = query;
      await loadPetsData(1, query);
      renderPetsPage(document.getElementById('page-content'));
    }
  });
  document.getElementById('search-pets').appendChild(searchBar);
  
  const listEl = document.getElementById('pets-list');
  if (data.data?.length) {
    listEl.innerHTML = `
      <table class="data-table">
        <thead><tr><th>Nombre</th><th>Especie</th><th>Raza</th><th>Cliente</th><th>Acciones</th></tr></thead>
        <tbody>${data.data.map(p => `
          <tr>
            <td>${p.name}</td>
            <td>${formatSpecies(p.species)}</td>
            <td>${p.breed || '-'}</td>
            <td>${p.client?.name || '-'}</td>
            <td><button class="btn btn-outline btn-sm" data-id="${p.id}" data-action="view">Ver</button></td>
          </tr>
        `).join('')}</tbody>
      </table>
    `;
  } else {
    listEl.innerHTML = '<div class="empty-state"><p>No hay mascotas</p></div>';
  }
  
  const paginationEl = document.getElementById('pets-pagination');
  if (data.meta?.total > 20) {
    const pagination = createPagination({
      total: data.meta.total,
      page: data.page,
      limit: 20,
      onPageChange: async (newPage) => {
        await loadPetsData(newPage, data.search);
        renderPetsPage(document.getElementById('page-content'));
      }
    });
    paginationEl.appendChild(pagination);
  }
  
  document.getElementById('add-pet-btn')?.addEventListener('click', showAddPetModal);
}

function showAddPetModal() {
  openModal({
    title: 'Nueva Mascota',
    content: `
      <div class="form-group">
        <label class="form-label required">Nombre</label>
        <input type="text" class="form-input" id="pet-name">
      </div>
      <div class="form-group">
        <label class="form-label required">Especie</label>
        <select class="form-input" id="pet-species">
          <option value="">Seleccionar...</option>
          <option value="DOG">Perro</option>
          <option value="CAT">Gato</option>
          <option value="HORSE">Caballo</option>
          <option value="BIRD">Ave</option>
          <option value="RABBIT">Conejo</option>
          <option value="REPTILE">Reptil</option>
          <option value="OTHER">Otro</option>
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Raza</label>
        <input type="text" class="form-input" id="pet-breed">
      </div>
      <div class="form-group">
        <label class="form-label">Género</label>
        <select class="form-input" id="pet-gender">
          <option value="">Seleccionar...</option>
          <option value="MALE">Macho</option>
          <option value="FEMALE">Hembra</option>
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Fecha de Nacimiento</label>
        <input type="date" class="form-input" id="pet-birthDate">
      </div>
      <div class="form-group">
        <label class="form-label">Peso (kg)</label>
        <input type="number" step="0.01" class="form-input" id="pet-weight">
      </div>
      <div class="form-group">
        <label class="form-label">Color</label>
        <input type="text" class="form-input" id="pet-color">
      </div>
      <div class="form-group">
        <label class="form-label">Microchip</label>
        <input type="text" class="form-input" id="pet-microchip">
      </div>
      <div class="form-group">
        <label class="form-label">Notas</label>
        <textarea class="form-input" id="pet-notes" rows="3"></textarea>
      </div>
    `,
    onConfirm: async () => {
      const name = document.getElementById('pet-name').value.trim();
      const species = document.getElementById('pet-species').value;
      
      if (!name || !species) {
        showToast('Nombre y especie son requeridos', 'error');
        return false;
      }
      
      try {
        await api.post('/pets', {
          name,
          species,
          breed: document.getElementById('pet-breed').value.trim(),
          gender: document.getElementById('pet-gender').value,
          birthDate: document.getElementById('pet-birthDate').value || null,
          weight: parseFloat(document.getElementById('pet-weight').value) || null,
          color: document.getElementById('pet-color').value.trim(),
          microchip: document.getElementById('pet-microchip').value.trim(),
          notes: document.getElementById('pet-notes').value.trim(),
        });
        
        showToast('Mascota creada', 'success');
        await loadPetsData(1, pageData.pets?.search || '');
        renderPetsPage(document.getElementById('page-content'));
      } catch (e) {
        showToast(e.message || 'Error creando mascota', 'error');
        return false;
      }
    }
  });
}

async function loadMedicalRecordsData(page = 1, petId = '') {
  try {
    const params = { page, limit: 20 };
    if (petId) params.petId = petId;
    
    const result = await api.get('/medical-records', params);
    pageData.medicalRecords = { ...result, page, petId };
  } catch (e) {
    pageData.medicalRecords = { data: [], meta: { total: 0 }, page, petId };
  }
}

async function renderMedicalRecordsPage(content) {
  const data = pageData.medicalRecords || { data: [], meta: { total: 0 } };
  
  content.innerHTML = `
    <div class="page-header">
      <div id="filter-records"></div>
      <button class="btn btn-primary" id="add-record-btn">Nueva Consulta</button>
    </div>
    <div id="records-list"></div>
    <div id="records-pagination"></div>
  `;
  
  const listEl = document.getElementById('records-list');
  if (data.data?.length) {
    listEl.innerHTML = `
      <table class="data-table">
        <thead><tr><th>Fecha</th><th>Mascota</th><th>Motivo</th><th>Diagnóstico</th><th>Acciones</th></tr></thead>
        <tbody>${data.data.map(r => `
          <tr>
            <td>${formatDate(r.date)}</td>
            <td>${r.pet?.name || '-'}</td>
            <td>${r.visitReason}</td>
            <td>${r.diagnosis || '-'}</td>
            <td><button class="btn btn-outline btn-sm" data-id="${r.id}" data-action="view">Ver</button></td>
          </tr>
        `).join('')}</tbody>
      </table>
    `;
  } else {
    listEl.innerHTML = '<div class="empty-state"><p>No hay historial médico</p></div>';
  }
  
  document.getElementById('add-record-btn')?.addEventListener('click', showAddRecordModal);
}

function showAddRecordModal() {
  openModal({
    title: 'Nueva Consulta',
    content: `
      <div class="form-group">
        <label class="form-label required">Mascota</label>
        <select class="form-input" id="record-petId"></select>
      </div>
      <div class="form-group">
        <label class="form-label required">Fecha</label>
        <input type="date" class="form-input" id="record-date" value="${new Date().toISOString().split('T')[0]}">
      </div>
      <div class="form-group">
        <label class="form-label required">Motivo de consulta</label>
        <input type="text" class="form-input" id="record-reason">
      </div>
      <div class="form-group">
        <label class="form-label">Diagnóstico</label>
        <textarea class="form-input" id="record-diagnosis" rows="3"></textarea>
      </div>
      <div class="form-group">
        <label class="form-label">Tratamiento</label>
        <textarea class="form-input" id="record-treatment" rows="3"></textarea>
      </div>
    `,
    onConfirm: async () => {
      const petId = document.getElementById('record-petId').value;
      const reason = document.getElementById('record-reason').value.trim();
      const date = document.getElementById('record-date').value;
      
      if (!petId || !reason || !date) {
        showToast('Los campos marcados con * son requeridos', 'error');
        return false;
      }
      
      try {
        await api.post('/medical-records', {
          petId,
          date,
          visitReason: reason,
          diagnosis: document.getElementById('record-diagnosis').value.trim(),
          treatment: document.getElementById('record-treatment').value.trim(),
        });
        
        showToast('Consulta creada', 'success');
        await loadMedicalRecordsData(1, pageData.medicalRecords?.petId);
        renderMedicalRecordsPage(document.getElementById('page-content'));
      } catch (e) {
        showToast(e.message || 'Error creando consulta', 'error');
        return false;
      }
    }
  });
  
  api.get('/pets').then(({ data }) => {
    const select = document.getElementById('record-petId');
    if (select && data?.length) {
      select.innerHTML = '<option value="">Seleccionar...</option>' +
        data.map(p => `<option value="${p.id}">${p.name}</option>`).join('');
    }
  }).catch(() => {});
}

async function loadPaymentsData(page = 1, status = '') {
  try {
    const params = { page, limit: 20 };
    if (status) params.status = status;
    
    const result = await api.get('/payments', params);
    pageData.payments = { ...result, page, status };
  } catch (e) {
    pageData.payments = { data: [], meta: { total: 0 }, page, status };
  }
}

async function loadDebtsData(page = 1, status = '') {
  try {
    const params = { page, limit: 20 };
    if (status) params.status = status;
    
    const result = await api.get('/debts', params);
    pageData.debts = { ...result, page, status };
  } catch (e) {
    pageData.debts = { data: [], meta: { total: 0 }, page, status };
  }
}

async function renderPaymentsPage(content) {
  const payments = pageData.payments?.data || [];
  const debts = pageData.debts?.data || [];
  
  content.innerHTML = `
    <style>
      .tabs { display: flex; gap: 8px; margin-bottom: 24px; }
      .tab { padding: 8px 16px; border: 1px solid var(--border); border-radius: var(--radius); cursor: pointer; }
      .tab.active { background: var(--primary); color: white; border-color: var(--primary); }
      .tab-content { display: none; }
      .tab-content.active { display: block; }
    </style>
    <div class="tabs">
      <div class="tab active" data-tab="payments">Pagos</div>
      <div class="tab" data-tab="debts">Deudas</div>
    </div>
    <div id="tab-payments" class="tab-content active">
      <div id="payments-list"></div>
    </div>
    <div id="tab-debts" class="tab-content">
      <div id="debts-list"></div>
    </div>
  `;
  
  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
      document.getElementById(`tab-${tab.dataset.tab}`).classList.add('active');
    });
  });
  
  const paymentsEl = document.getElementById('payments-list');
  if (payments.length) {
    paymentsEl.innerHTML = `
      <table class="data-table">
        <thead><tr><th>Fecha</th><th>Cliente</th><th>Total</th><th>Estado</th><th>Método</th></tr></thead>
        <tbody>${payments.map(p => `
          <tr>
            <td>${formatDate(p.createdAt)}</td>
            <td>${p.client?.name || '-'}</td>
            <td>${formatCurrency(p.totalAmount)}</td>
            <td><span class="badge badge-${p.status === 'PAID' ? 'success' : p.status === 'PENDING' ? 'warning' : 'danger'}">${formatStatus(p.status, 'payment')}</span></td>
            <td>${p.method || '-'}</td>
          </tr>
        `).join('')}</tbody>
      </table>
    `;
  } else {
    paymentsEl.innerHTML = '<div class="empty-state"><p>No hay pagos</p></div>';
  }
  
  const debtsEl = document.getElementById('debts-list');
  if (debts.length) {
    debtsEl.innerHTML = `
      <table class="data-table">
        <thead><tr><th>Cliente</th><th>Monto</th><th>Vencimiento</th><th>Estado</th><th>Acciones</th></tr></thead>
        <tbody>${debts.map(d => `
          <tr>
            <td>${d.client?.name || '-'}</td>
            <td>${formatCurrency(d.amount)}</td>
            <td>${formatDate(d.dueDate)}</td>
            <td><span class="badge badge-${d.status === 'PAID' ? 'success' : d.status === 'OVERDUE' ? 'danger' : 'warning'}">${formatStatus(d.status, 'debt')}</span></td>
            <td>
              ${d.status !== 'PAID' ? `<button class="btn btn-outline btn-sm" data-id="${d.id}" data-action="pay">Pagar</button>` : ''}
            </td>
          </tr>
        `).join('')}</tbody>
      </table>
    `;
    
    debtsEl.querySelectorAll('[data-action="pay"]').forEach(btn => {
      btn.addEventListener('click', async () => {
        try {
          await api.patch(`/debts/${btn.dataset.id}`, { status: 'PAID' });
          showToast('Deuda marcada como pagada', 'success');
          await Promise.all([loadPaymentsData(), loadDebtsData()]);
          renderPaymentsPage(document.getElementById('page-content'));
        } catch (e) {
          showToast(e.message || 'Error actualizando deuda', 'error');
        }
      });
    });
  } else {
    debtsEl.innerHTML = '<div class="empty-state"><p>No hay deudas</p></div>';
  }
}

async function loadSuppliesData(page = 1, search = '') {
  try {
    const params = { page, limit: 20 };
    if (search) params.search = search;
    
    const result = await api.get('/supplies', params);
    pageData.supplies = { ...result, page, search };
  } catch (e) {
    pageData.supplies = { data: [], meta: { total: 0 }, page, search };
  }
}

async function renderSuppliesPage(content) {
  const data = pageData.supplies || { data: [], meta: { total: 0 } };
  
  content.innerHTML = `
    <div class="page-header">
      <div id="search-supplies"></div>
      <div style="display: flex; gap: 8px; flex-wrap: wrap;">
        <button class="btn btn-outline" id="download-template-btn">📥 Plantilla Excel</button>
        <button class="btn btn-outline" id="export-supplies-btn">📤 Exportar Excel</button>
        <button class="btn btn-outline" id="import-supplies-btn">
          📂 Importar Excel
          <input type="file" id="import-supplies-input" accept=".xlsx,.xls" style="display: none;">
        </button>
        <button class="btn btn-primary" id="add-supply-btn">Nuevo Insumo</button>
      </div>
    </div>
    <div id="supplies-list"></div>
    <div id="supplies-pagination"></div>
  `;
  
  const searchBar = createSearchBar({
    placeholder: 'Buscar insumos...',
    initialValue: data.search || '',
    onSearch: async (query) => {
      pageData.supplies.search = query;
      await loadSuppliesData(1, query);
      renderSuppliesPage(document.getElementById('page-content'));
    }
  });
  document.getElementById('search-supplies').appendChild(searchBar);
  
  document.getElementById('download-template-btn')?.addEventListener('click', async () => {
    try {
      const blob = await api.getBlob('/supplies/template');
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = 'plantilla-insumos.xlsx'; a.click();
      URL.revokeObjectURL(url);
    } catch (e) { showToast('Error al descargar plantilla', 'error'); }
  });

  document.getElementById('export-supplies-btn')?.addEventListener('click', async () => {
    try {
      const blob = await api.getBlob('/supplies/export');
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = 'insumos-exportados.xlsx'; a.click();
      URL.revokeObjectURL(url);
    } catch (e) { showToast('Error al exportar', 'error'); }
  });

  document.getElementById('import-supplies-btn')?.addEventListener('click', () => {
    document.getElementById('import-supplies-input')?.click();
  });

  document.getElementById('import-supplies-input')?.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const formData = new FormData();
    formData.append('file', file);
    try {
      const result = await api.postFormData('/supplies/import', formData);
      showToast(`✅ ${result.imported || result.created} insumos importados correctamente`, 'success');
      if (result.errors?.length) {
        console.warn('Errores de importación:', result.errors);
        showToast(`⚠️ ${result.errors.length} filas con errores (ver consola)`, 'warning');
      }
      await loadSuppliesData(1, pageData.supplies?.search || ''); 
      renderSuppliesPage(document.getElementById('page-content'));
    } catch (e) { showToast(e.message || 'Error al importar', 'error'); }
    e.target.value = '';
  });
  
  const listEl = document.getElementById('supplies-list');
  if (data.data?.length) {
    listEl.innerHTML = `
      <table class="data-table">
        <thead><tr><th>Nombre</th><th>Marca</th><th>Stock</th><th>Precio</th><th>Estado</th></tr></thead>
        <tbody>${data.data.map(s => {
          const isLow = s.quantity <= (s.minQuantity || 10);
          return `
            <tr>
              <td>${s.name}</td>
              <td>${s.brand || '-'}</td>
              <td>${s.quantity}</td>
              <td>${formatCurrency(s.unitPrice)}</td>
              <td><span class="badge badge-${isLow ? 'danger' : 'success'}">${isLow ? 'Bajo stock' : 'OK'}</span></td>
            </tr>
          `;
        }).join('')}</tbody>
      </table>
    `;
  } else {
    listEl.innerHTML = '<div class="empty-state"><p>No hay insumos</p></div>';
  }
  
  document.getElementById('add-supply-btn')?.addEventListener('click', showAddSupplyModal);
}

function showAddSupplyModal() {
  openModal({
    title: 'Nuevo Insumo',
    content: `
      <div class="form-group">
        <label class="form-label required">Nombre</label>
        <input type="text" class="form-input" id="supply-name">
      </div>
      <div class="form-group">
        <label class="form-label">Marca</label>
        <input type="text" class="form-input" id="supply-brand">
      </div>
      <div class="form-group">
        <label class="form-label">Categoría</label>
        <select class="form-input" id="supply-category">
          <option value="">Seleccionar...</option>
          <option value="MEDICAMENTO">Medicamento</option>
          <option value="INSUMO">Insumo</option>
          <option value="ALIMENTO">Alimento</option>
          <option value="OTRO">Otro</option>
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Unidad</label>
        <input type="text" class="form-input" id="supply-unit" placeholder="ej: ml, comprimido">
      </div>
      <div class="form-group">
        <label class="form-label">Cantidad</label>
        <input type="number" class="form-input" id="supply-quantity">
      </div>
      <div class="form-group">
        <label class="form-label">Precio unitario</label>
        <input type="number" step="0.01" class="form-input" id="supply-price">
      </div>
      <div class="form-group">
        <label class="form-label">Stock mínimo</label>
        <input type="number" class="form-input" id="supply-minQuantity">
      </div>
    `,
    onConfirm: async () => {
      const name = document.getElementById('supply-name').value.trim();
      if (!name) {
        showFieldError('supply-name', 'El nombre es requerido');
        return false;
      }
      
      try {
        await api.post('/supplies', {
          name,
          brand: document.getElementById('supply-brand').value.trim(),
          category: document.getElementById('supply-category').value,
          unit: document.getElementById('supply-unit').value.trim(),
          quantity: parseInt(document.getElementById('supply-quantity').value) || 0,
          unitPrice: parseFloat(document.getElementById('supply-price').value) || 0,
          minQuantity: parseInt(document.getElementById('supply-minQuantity').value) || 10,
        });
        
        showToast('Insumo creado', 'success');
        await loadSuppliesData(1, pageData.supplies?.search || '');
        renderSuppliesPage(document.getElementById('page-content'));
      } catch (e) {
        showToast(e.message || 'Error creando insumo', 'error');
        return false;
      }
    }
  });
}

async function renderChatPage(content) {
  content.innerHTML = `
    <div class="chat-container">
      <div class="chat-messages" id="chat-messages">
        <div class="chat-message assistant">Hola, soy el asistente de IA. ¿En qué puedo ayudarte hoy?</div>
      </div>
      <div class="chat-input">
        <textarea id="chat-input" placeholder="Escribe tu mensaje..."></textarea>
        <button class="btn btn-primary" id="send-chat-btn">Enviar</button>
      </div>
    </div>
  `;
  
  const messagesEl = document.getElementById('chat-messages');
  const inputEl = document.getElementById('chat-input');
  const sendBtn = document.getElementById('send-chat-btn');
  const chatHistory = [];
  
  async function sendMessage() {
    const msg = inputEl.value.trim();
    if (!msg) return;
    
    chatHistory.push({ role: 'user', content: msg });
    messagesEl.innerHTML += `<div class="chat-message user">${msg}</div>`;
    inputEl.value = '';
    messagesEl.scrollTop = messagesEl.scrollHeight;
    
    messagesEl.innerHTML += '<div class="chat-message assistant typing">Escribiendo...</div>';
    messagesEl.scrollTop = messagesEl.scrollHeight;
    
    try {
      const { message } = await api.post('/ai/chat', { messages: chatHistory });
      chatHistory.push(message);
      
      messagesEl.querySelector('.typing')?.remove();
      messagesEl.innerHTML += `<div class="chat-message assistant">${message.content}</div>`;
    } catch (e) {
      messagesEl.querySelector('.typing')?.remove();
      messagesEl.innerHTML += '<div class="chat-message assistant">Lo siento, houve un error. Intenta de nuevo.</div>';
    }
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }
  
  sendBtn.addEventListener('click', sendMessage);
  inputEl.addEventListener('keypress', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } });
}

async function loadConnectionsData(page = 1, status = '') {
  try {
    const params = { page, limit: 20 };
    if (status) params.status = status;
    
    const result = await api.get('/connections', params);
    pageData.connections = { ...result, page, status };
  } catch (e) {
    pageData.connections = { data: [], meta: { total: 0 }, page, status };
  }
}

async function renderConnectionsPage(content) {
  const data = pageData.connections || { data: [], meta: { total: 0 } };
  
  content.innerHTML = `
    <div class="page-header">
      <button class="btn btn-primary" id="request-connection-btn">Solicitar Conexión</button>
    </div>
    <div id="connections-list"></div>
  `;
  
  const listEl = document.getElementById('connections-list');
  if (data.data?.length) {
    listEl.innerHTML = `
      <table class="data-table">
        <thead><tr><th>Veterinaria</th><th>Estado</th><th>Fecha</th><th>Acciones</th></tr></thead>
        <tbody>${data.data.map(c => `
          <tr>
            <td>${c.company?.name || '-'}</td>
            <td><span class="badge badge-${c.status === 'ACCEPTED' ? 'success' : c.status === 'PENDING' ? 'warning' : 'danger'}">${formatStatus(c.status, 'connection')}</span></td>
            <td>${formatDate(c.createdAt)}</td>
            <td>
              ${c.status === 'PENDING' ? `<button class="btn btn-outline btn-sm" data-id="${c.id}" data-action="accept">Aceptar</button>` : ''}
            </td>
          </tr>
        `).join('')}</tbody>
      </table>
    `;

    listEl.querySelectorAll('[data-action="accept"]').forEach(btn => {
      btn.addEventListener('click', async () => {
        try {
          await api.patch(`/connections/${btn.dataset.id}`, { status: 'ACCEPTED' });
          showToast('Conexión aceptada', 'success');
          await loadConnectionsData(pageData.connections?.page || 1, '');
          renderConnectionsPage(document.getElementById('page-content'));
        } catch (e) {
          showToast(e.message || 'Error', 'error');
        }
      });
    });
  } else {
    listEl.innerHTML = '<div class="empty-state"><p>No hay conexiones</p></div>';
  }

  document.getElementById('request-connection-btn')?.addEventListener('click', () => {
    openModal({
      title: 'Solicitar Conexión con otra Clínica',
      content: `
        <div class="form-group">
          <label class="form-label">Buscar empresa por nombre o email</label>
          <input type="text" class="form-input" id="search-company-input" placeholder="Buscar...">
        </div>
        <div id="company-search-results"></div>
      `,
      confirmText: null,
      cancelText: 'Cerrar',
    });

    let searchTimeout;
    document.getElementById('search-company-input')?.addEventListener('input', (e) => {
      clearTimeout(searchTimeout);
      const q = e.target.value.trim();
      if (q.length < 2) return;
      searchTimeout = setTimeout(async () => {
        const resultsEl = document.getElementById('company-search-results');
        if (!resultsEl) return;
        resultsEl.innerHTML = 'Buscando...';
        try {
          const companies = await api.get(`/companies/search?q=${encodeURIComponent(q)}`);
          if (!companies?.length) {
            resultsEl.innerHTML = 'No se encontraron empresas.';
            return;
          }
          resultsEl.innerHTML = companies.map(c => `
            <div style="padding: 8px; border-bottom: 1px solid var(--border); display: flex; justify-content: space-between; align-items: center;">
              <div>
                <strong>${c.name}</strong>
                ${c.email ? `<br><small>${c.email}</small>` : ''}
              </div>
              <button class="btn btn-outline btn-sm" data-company-id="${c.id}" data-company-name="${c.name}">Conectar</button>
            </div>
          `).join('');
          resultsEl.querySelectorAll('button[data-company-id]').forEach(btn => {
            btn.addEventListener('click', async () => {
              btn.disabled = true;
              btn.textContent = 'Enviando...';
              try {
                await api.post('/connections', { companyBId: btn.dataset.companyId });
                showToast(`Solicitud enviada a ${btn.dataset.companyName}`, 'success');
                closeModal();
                await loadConnectionsData(pageData.connections?.page || 1, '');
                renderConnectionsPage(document.getElementById('page-content'));
              } catch (e) {
                showToast(e.message || 'Error al enviar solicitud', 'error');
                btn.disabled = false;
                btn.textContent = 'Conectar';
              }
            });
          });
        } catch (e) {
          resultsEl.innerHTML = `Error: ${e.message}`;
        }
      }, 400);
    });
  });
}

async function renderSettingsPage(tab) {
  const content = document.getElementById('page-content');
  content.innerHTML = `
    <style>
      .subscription-status-card { background: var(--surface); border: 1.5px solid var(--border); border-radius: var(--radius-xl); padding: var(--space-6); margin-bottom: var(--space-6); }
      .subscription-status-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: var(--space-4); }
      .subscription-badge { display: inline-flex; align-items: center; gap: var(--space-2); padding: var(--space-1) var(--space-3); border-radius: var(--radius-full); font-size: var(--text-sm); font-weight: 600; }
      .badge-trial { background: rgba(245,158,11,0.12); color: #b45309; }
      .badge-active { background: rgba(16,185,129,0.12); color: #065f46; }
      .badge-expired { background: rgba(239,68,68,0.12); color: #991b1b; }
      .badge-cancelled { background: rgba(107,114,128,0.12); color: #374151; }
      .subscription-meta { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: var(--space-4); margin-top: var(--space-4); }
      .subscription-meta-item { display: flex; flex-direction: column; gap: var(--space-1); }
      .subscription-meta-label { font-size: var(--text-xs); color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.05em; }
      .subscription-meta-value { font-size: var(--text-base); font-weight: 600; color: var(--text-primary); }
      .plans-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: var(--space-4); margin-bottom: var(--space-6); }
      .plan-card { border: 2px solid var(--border); border-radius: var(--radius-xl); padding: var(--space-6); position: relative; transition: all var(--transition); cursor: pointer; }
      .plan-card:hover { border-color: var(--color-sage); box-shadow: var(--shadow-md); }
      .plan-card.featured { border-color: var(--color-forest); background: rgba(27,67,50,0.03); }
      .plan-card.current { border-color: var(--color-sage); background: rgba(106,153,85,0.05); }
      .plan-badge-featured { position: absolute; top: -12px; left: 50%; transform: translateX(-50%); background: var(--color-forest); color: white; font-size: var(--text-xs); font-weight: 700; padding: 2px 12px; border-radius: var(--radius-full); white-space: nowrap; }
      .plan-name { font-size: var(--text-lg); font-weight: 700; color: var(--text-primary); margin-bottom: var(--space-1); }
      .plan-price { font-size: var(--text-3xl); font-weight: 800; color: var(--color-forest); margin-bottom: var(--space-1); }
      .plan-price span { font-size: var(--text-sm); font-weight: 400; color: var(--text-secondary); }
      .plan-saving { font-size: var(--text-xs); color: #065f46; background: rgba(16,185,129,0.1); padding: 2px 8px; border-radius: var(--radius-full); display: inline-block; margin-bottom: var(--space-3); }
      .plan-features { list-style: none; padding: 0; margin: var(--space-4) 0; display: flex; flex-direction: column; gap: var(--space-2); }
      .plan-features li { font-size: var(--text-sm); color: var(--text-secondary); display: flex; align-items: center; gap: var(--space-2); }
      .plan-features li::before { content: "✓"; color: var(--color-forest); font-weight: 700; }
      .plan-btn { width: 100%; margin-top: var(--space-2); }
      .subscription-trial-banner { background: linear-gradient(135deg, rgba(245,158,11,0.1), rgba(217,119,6,0.08)); border: 1.5px solid rgba(245,158,11,0.3); border-radius: var(--radius-lg); padding: var(--space-4); margin-bottom: var(--space-6); display: flex; align-items: center; gap: var(--space-3); }
      .trial-banner-icon { font-size: 1.5rem; }
      .trial-banner-text strong { display: block; color: #92400e; font-weight: 700; }
      .trial-banner-text span { font-size: var(--text-sm); color: #b45309; }
    </style>
    <div class="settings-nav">
      <a class="settings-tab ${tab === 'company' ? 'active' : ''}" href="/settings/company">Empresa</a>
      <a class="settings-tab ${tab === 'subscription' ? 'active' : ''}" href="/settings/subscription">Suscripción</a>
      <a class="settings-tab ${tab === 'mercadopago' ? 'active' : ''}" href="/settings/mercadopago">MercadoPago</a>
      <a class="settings-tab ${tab === 'prices' ? 'active' : ''}" href="/settings/prices">Precios</a>
      <a class="settings-tab ${tab === 'ai' ? 'active' : ''}" href="/settings/ai">IA</a>
      <a class="settings-tab ${tab === 'connections' ? 'active' : ''}" href="/settings/connections">Conexiones</a>
    </div>
    <div id="settings-content"></div>
  `;
  
  document.querySelectorAll('.settings-tab').forEach(t => {
    t.addEventListener('click', (e) => {
      e.preventDefault();
      window.location.href = t.href;
    });
  });
  
  const contentEl = document.getElementById('settings-content');
  
  switch (tab) {
    case 'company': await renderSettingsCompanyContent(contentEl); break;
    case 'subscription': await renderSettingsSubscriptionContent(contentEl); break;
    case 'mercadopago': await renderSettingsMercadoPagoContent(contentEl); break;
    case 'prices': await renderSettingsPricesContent(contentEl); break;
    case 'ai': await renderSettingsAIContent(contentEl); break;
    case 'connections': await renderSettingsConnectionsContent(contentEl); break;
  }
}

async function renderSettingsCompanyContent(content) {
  try {
    const { data: company } = await api.get('/companies/me');
    
    content.innerHTML = `
      <div class="settings-section">
        <h3>Información de la Empresa</h3>
        <div class="form-group">
          <label class="form-label">Nombre</label>
          <input type="text" class="form-input" id="company-name" value="${company?.name || ''}">
        </div>
        <div class="form-group">
          <label class="form-label">Razón Social</label>
          <input type="text" class="form-input" id="company-businessName" value="${company?.businessName || ''}">
        </div>
        <div class="form-group">
          <label class="form-label">Teléfono</label>
          <input type="tel" class="form-input" id="company-phone" value="${company?.phone || ''}">
        </div>
        <div class="form-group">
          <label class="form-label">Dirección</label>
          <input type="text" class="form-input" id="company-address" value="${company?.address || ''}">
        </div>
        <div class="form-group">
          <label class="form-label">Email</label>
          <input type="email" class="form-input" id="company-email" value="${company?.email || ''}">
        </div>
        <div class="form-group">
          <label class="form-label">Website</label>
          <input type="url" class="form-input" id="company-website" value="${company?.website || ''}">
        </div>
        <button class="btn btn-primary" id="save-company-btn">Guardar</button>
      </div>
    `;
    
    document.getElementById('save-company-btn').addEventListener('click', async () => {
      try {
        await api.put('/companies', {
          name: document.getElementById('company-name').value,
          businessName: document.getElementById('company-businessName').value,
          phone: document.getElementById('company-phone').value,
          address: document.getElementById('company-address').value,
          email: document.getElementById('company-email').value,
          website: document.getElementById('company-website').value,
        });
        showToast('Empresa actualizada', 'success');
      } catch (e) {
        showToast(e.message || 'Error guardando', 'error');
      }
    });
  } catch (e) {
    content.innerHTML = '<div class="empty-state"><p>Error cargando datos</p></div>';
  }
}

async function renderSettingsSubscriptionContent(content) {
  content.innerHTML = '<div class="loading-spinner"></div>';
  
  let sub;
  try {
    sub = await api.get('/subscriptions/status');
  } catch (e) {
    content.innerHTML = '<div class="empty-state"><p>Error cargando suscripción. Intenta nuevamente.</p></div>';
    return;
  }

  const now = new Date();
  const trialEnd = sub.trialEndsAt ? new Date(sub.trialEndsAt) : null;
  const expireEnd = sub.expiresAt ? new Date(sub.expiresAt) : null;
  const trialDaysLeft = trialEnd ? Math.max(0, Math.ceil((trialEnd - now) / (1000 * 60 * 60 * 24))) : 0;
  const expireDaysLeft = expireEnd ? Math.max(0, Math.ceil((expireEnd - now) / (1000 * 60 * 60 * 24))) : 0;

  const statusLabels = { TRIAL: 'Prueba gratuita', ACTIVE: 'Activo', EXPIRED: 'Expirado', CANCELLED: 'Cancelado', BLOCKED: 'Bloqueado' };
  const statusBadgeClass = { TRIAL: 'badge-trial', ACTIVE: 'badge-active', EXPIRED: 'badge-expired', CANCELLED: 'badge-cancelled', BLOCKED: 'badge-expired' };
  const planLabels = { TRIAL: 'Trial', MONTHLY: 'Mensual', YEARLY: 'Anual' };

  const isActive = sub.status === 'ACTIVE';
  const isTrial = sub.status === 'TRIAL';
  const isExpired = ['EXPIRED', 'BLOCKED'].includes(sub.status);
  const isCancelled = sub.status === 'CANCELLED';

  const trialBanner = isTrial ? `
    <div class="subscription-trial-banner">
      <div class="trial-banner-icon">⏳</div>
      <div class="trial-banner-text">
        <strong>Estás en el período de prueba gratuita</strong>
        <span>${trialDaysLeft > 0 ? `Te quedan ${trialDaysLeft} días` : 'Tu trial ha vencido'}. Suscribite para continuar usando PataSoft.</span>
      </div>
    </div>
  ` : '';

  const expiredBanner = isExpired ? `
    <div class="subscription-trial-banner" style="background: rgba(239,68,68,0.08); border-color: rgba(239,68,68,0.3);">
      <div class="trial-banner-icon">🔒</div>
      <div class="trial-banner-text">
        <strong style="color:#991b1b;">Tu suscripción ha vencido</strong>
        <span style="color:#b91c1c;">Renová tu plan para recuperar el acceso completo.</span>
      </div>
    </div>
  ` : '';

  content.innerHTML = `
    <div class="settings-section">
      <h3>Suscripción</h3>

      ${trialBanner}
      ${expiredBanner}

      <div class="subscription-status-card">
        <div class="subscription-status-header">
          <div>
            <div style="font-size: var(--text-sm); color: var(--text-secondary); margin-bottom: var(--space-1);">Plan actual</div>
            <div style="font-size: var(--text-xl); font-weight: 700;">${planLabels[sub.plan] || sub.plan}</div>
          </div>
          <span class="subscription-badge ${statusBadgeClass[sub.status] || 'badge-trial'}">
            ${statusLabels[sub.status] || sub.status}
          </span>
        </div>
        <div class="subscription-meta">
          ${isTrial && trialEnd ? `
            <div class="subscription-meta-item">
              <span class="subscription-meta-label">Trial vence</span>
              <span class="subscription-meta-value">${formatDate(sub.trialEndsAt)}</span>
            </div>
          ` : ''}
          ${isActive && expireEnd ? `
            <div class="subscription-meta-item">
              <span class="subscription-meta-label">Próximo vencimiento</span>
              <span class="subscription-meta-value">${formatDate(sub.expiresAt)} (${expireDaysLeft} días)</span>
            </div>
          ` : ''}
          ${isCancelled && sub.cancelledAt ? `
            <div class="subscription-meta-item">
              <span class="subscription-meta-label">Cancelado el</span>
              <span class="subscription-meta-value">${formatDate(sub.cancelledAt)}</span>
            </div>
          ` : ''}
          <div class="subscription-meta-item">
            <span class="subscription-meta-label">Desde</span>
            <span class="subscription-meta-value">${formatDate(sub.startedAt)}</span>
          </div>
        </div>
      </div>

      <h4 style="margin-bottom: var(--space-4); color: var(--text-secondary); font-weight: 600; text-transform: uppercase; font-size: var(--text-sm); letter-spacing: 0.05em;">
        ${isActive ? 'Cambiar plan' : 'Elegí tu plan'}
      </h4>

      <div class="plans-grid">
        <div class="plan-card ${sub.plan === 'MONTHLY' && isActive ? 'current' : ''}">
          ${sub.plan === 'MONTHLY' && isActive ? '<div class="plan-badge-featured">Plan actual</div>' : ''}
          <div class="plan-name">Mensual</div>
          <div class="plan-price">$5.000 <span>/ mes</span></div>
          <ul class="plan-features">
            <li>Clientes y mascotas ilimitados</li>
            <li>Historiales clínicos completos</li>
            <li>Gestión de insumos y stock</li>
            <li>Pagos y deudas</li>
            <li>Chat con IA veterinaria</li>
            <li>Soporte por email</li>
          </ul>
          <button class="btn ${sub.plan === 'MONTHLY' && isActive ? 'btn-secondary' : 'btn-primary'} plan-btn" 
                  id="btn-subscribe-monthly"
                  ${sub.plan === 'MONTHLY' && isActive ? 'disabled' : ''}>
            ${sub.plan === 'MONTHLY' && isActive ? 'Plan activo' : 'Suscribirme mensual'}
          </button>
        </div>

        <div class="plan-card featured ${sub.plan === 'YEARLY' && isActive ? 'current' : ''}">
          ${sub.plan === 'YEARLY' && isActive ? '<div class="plan-badge-featured">Plan actual</div>' : '<div class="plan-badge-featured">Recomendado</div>'}
          <div class="plan-name">Anual</div>
          <div class="plan-price">$50.000 <span>/ año</span></div>
          <div class="plan-saving">Ahorrás $10.000 vs mensual</div>
          <ul class="plan-features">
            <li>Todo lo del plan mensual</li>
            <li>2 meses gratis</li>
            <li>Conexiones con otras clínicas</li>
            <li>Exportación de reportes PDF</li>
            <li>Soporte prioritario</li>
            <li>Configuración de precios personalizada</li>
          </ul>
          <button class="btn ${sub.plan === 'YEARLY' && isActive ? 'btn-secondary' : 'btn-primary'} plan-btn"
                  id="btn-subscribe-yearly"
                  ${sub.plan === 'YEARLY' && isActive ? 'disabled' : ''}>
            ${sub.plan === 'YEARLY' && isActive ? 'Plan activo' : 'Suscribirme anual'}
          </button>
        </div>
      </div>

      ${isActive ? `
        <div style="border-top: 1px solid var(--border); padding-top: var(--space-6); margin-top: var(--space-2);">
          <h4 style="margin-bottom: var(--space-2); color: var(--text-primary);">Cancelar suscripción</h4>
          <p style="font-size: var(--text-sm); color: var(--text-secondary); margin-bottom: var(--space-4);">
            Al cancelar, podrás seguir usando PataSoft hasta el ${formatDate(sub.expiresAt)}. No se realizará ningún cargo adicional.
          </p>
          <button class="btn btn-secondary" id="btn-cancel-subscription">Cancelar suscripción</button>
        </div>
      ` : ''}
    </div>
  `;

  async function handleSubscribe(plan) {
    const btn = document.getElementById(`btn-subscribe-${plan.toLowerCase()}`);
    if (!btn || btn.disabled) return;
    
    const originalText = btn.textContent;
    btn.disabled = true;
    btn.textContent = 'Procesando...';
    
    try {
      const result = await api.post('/subscriptions/checkout', { plan: plan.toUpperCase() });
      if (result.initPoint) {
        window.location.href = result.initPoint;
      } else {
        showToast('Error al iniciar el pago', 'error');
        btn.disabled = false;
        btn.textContent = originalText;
      }
    } catch (e) {
      showToast(e.message || 'Error al procesar la suscripción', 'error');
      btn.disabled = false;
      btn.textContent = originalText;
    }
  }

  document.getElementById('btn-subscribe-monthly')?.addEventListener('click', () => handleSubscribe('MONTHLY'));
  document.getElementById('btn-subscribe-yearly')?.addEventListener('click', () => handleSubscribe('YEARLY'));

  document.getElementById('btn-cancel-subscription')?.addEventListener('click', async () => {
    const confirmed = await new Promise(resolve => {
      openModal({
        title: 'Cancelar suscripción',
        content: '<p>¿Estás seguro que querés cancelar? Podrás seguir usando PataSoft hasta el vencimiento del período actual.</p>',
        confirmText: 'Sí, cancelar',
        cancelText: 'Volver',
        onConfirm: () => resolve(true),
        onCancel: () => resolve(false),
      });
    });

    if (!confirmed) return;

    try {
      await api.post('/subscriptions/cancel');
      showToast('Suscripción cancelada', 'success');
      await renderSettingsSubscriptionContent(content);
    } catch (e) {
      showToast(e.message || 'Error al cancelar', 'error');
    }
  });

  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get('success') === 'true') {
    showToast('¡Pago recibido! Tu suscripción se activará en instantes.', 'success');
    history.replaceState(null, '', window.location.pathname);
  } else if (urlParams.get('error') === 'true') {
    showToast('El pago no pudo procesarse. Intenta nuevamente.', 'error');
    history.replaceState(null, '', window.location.pathname);
  }
}

async function renderSettingsMercadoPagoContent(content) {
  try {
    const { data: config } = await api.get('/companies/config');
    
    content.innerHTML = `
      <div class="settings-section">
        <h3>MercadoPago</h3>
        <div class="form-group">
          <label class="form-label">Access Token</label>
          <input type="password" class="form-input" id="mp-access-token" value="${config?.mpAccessToken || ''}" placeholder="Access Token">
        </div>
        <div class="form-group">
          <label class="form-label">Public Key</label>
          <input type="text" class="form-input" id="mp-public-key" value="${config?.mpPublicKey || ''}" placeholder="Public Key">
        </div>
        <button class="btn btn-primary" id="save-mp-btn">Guardar</button>
      </div>
    `;
    
    document.getElementById('save-mp-btn').addEventListener('click', async () => {
      try {
        await api.put('/companies/config', {
          mpAccessToken: document.getElementById('mp-access-token').value,
          mpPublicKey: document.getElementById('mp-public-key').value,
        });
        showToast('Configuración guardada', 'success');
      } catch (e) {
        showToast(e.message || 'Error guardando', 'error');
      }
    });
  } catch (e) {
    content.innerHTML = '<div class="empty-state"><p>Error cargando configuración</p></div>';
  }
}

async function loadPriceItemsData(page = 1, search = '') {
  try {
    const params = { page, limit: 20 };
    if (search) params.search = search;
    
    const result = await api.get('/price-items', params);
    pageData.priceItems = { ...result, page, search };
  } catch (e) {
    pageData.priceItems = { data: [], meta: { total: 0 }, page, search };
  }
}

async function renderSettingsPricesContent(content) {
  const data = pageData.priceItems || { data: [], meta: { total: 0 } };
  
  content.innerHTML = `
    <div class="page-header">
      <div id="search-prices"></div>
      <button class="btn btn-primary" id="add-price-btn">Nuevo Precio</button>
    </div>
    <div id="prices-list"></div>
  `;
  
  const listEl = document.getElementById('prices-list');
  if (data.data?.length) {
    listEl.innerHTML = `
      <table class="data-table">
        <thead><tr><th>Nombre</th><th>Categoría</th><th>Precio</th></tr></thead>
        <tbody>${data.data.map(p => `
          <tr>
            <td>${p.name}</td>
            <td>${p.category || '-'}</td>
            <td>${formatCurrency(p.price)}</td>
          </tr>
        `).join('')}</tbody>
      </table>
    `;
  } else {
    listEl.innerHTML = '<div class="empty-state"><p>No hay precios</p></div>';
  }
}

async function renderSettingsAIContent(content) {
  try {
    const [{ data: config }, ragStatus] = await Promise.all([
      api.get('/companies/config'),
      api.get('/ai/rag/status').catch(() => ({ synced: false, error: 'No disponible' }))
    ]);
    
    content.innerHTML = `
      <div class="settings-section">
        <h3>Configuración de IA</h3>
        <div class="form-group">
          <label class="form-label">Modelo predeterminado</label>
          <select class="form-input" id="ai-model">
            <option value="llama-3.3-70b-versatile" ${config?.defaultAIModel === 'llama-3.3-70b-versatile' ? 'selected' : ''}>Llama 3.3 (Groq)</option>
            <option value="gpt-4o" ${config?.defaultAIModel === 'gpt-4o' ? 'selected' : ''}>GPT-4o (OpenAI)</option>
            <option value="gemini-1.5-flash" ${config?.defaultAIModel === 'gemini-1.5-flash' ? 'selected' : ''}>Gemini (Google)</option>
          </select>
        </div>
        <button class="btn btn-primary" id="save-ai-btn">Guardar</button>
      </div>

      <div class="settings-section" style="margin-top: var(--space-6);">
        <h3>Base de Conocimiento (RAG)</h3>
        
        <div style="background: var(--bg); border-radius: var(--radius-lg); padding: var(--space-4); margin-bottom: var(--space-4);">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <div>
              <span style="font-weight: 600;">Estado del RAG</span>
              <span class="badge ${ragStatus?.documents_count > 0 ? 'badge-success' : 'badge-warning'}" style="margin-left: var(--space-2);">
                ${ragStatus?.documents_count || 0} documentos
              </span>
            </div>
            <button class="btn btn-outline btn-sm" id="sync-rag-btn">🔄 Sincronizar datos</button>
          </div>
          <p style="font-size: var(--text-xs); color: var(--text-secondary); margin-top: var(--space-2);">
            Sincronizá clientes, mascotas, insumos e historiales médicos desde tu base de datos.
          </p>
        </div>

        <p style="color: var(--text-secondary); font-size: var(--text-sm); margin-bottom: var(--space-4);">
          Cargá documentos PDF o TXT para que la IA pueda responder preguntas sobre el contenido de tus archivos.
        </p>
        <div style="border: 2px dashed var(--border); border-radius: var(--radius-lg); padding: var(--space-6); text-align: center;">
          <input type="file" id="rag-file-input" accept=".pdf,.txt" style="display: none;">
          <button class="btn btn-outline" id="upload-rag-btn">📄 Subir documento</button>
          <p style="font-size: var(--text-xs); color: var(--text-secondary); margin-top: var(--space-2);">
            Formatos admitidos: PDF, TXT (máx 10MB)
          </p>
        </div>
        <div id="rag-files-list" style="margin-top: var(--space-4);"></div>
      </div>
    `;
    
    document.getElementById('save-ai-btn').addEventListener('click', async () => {
      try {
        await api.put('/companies/config', {
          defaultAIModel: document.getElementById('ai-model').value,
        });
        showToast('Configuración guardada', 'success');
      } catch (e) {
        showToast(e.message || 'Error guardando', 'error');
      }
    });

    document.getElementById('upload-rag-btn')?.addEventListener('click', () => {
      document.getElementById('rag-file-input')?.click();
    });

    document.getElementById('rag-file-input')?.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      
      const formData = new FormData();
      formData.append('file', file);
      
      try {
        showToast('Subiendo documento...', 'info');
        await api.post('/ai/rag/upload', formData);
        showToast('Documento subido correctamente', 'success');
        e.target.value = '';
      } catch (err) {
        showToast(err.message || 'Error al subir documento', 'error');
      }
    });

    document.getElementById('sync-rag-btn')?.addEventListener('click', async () => {
      const btn = document.getElementById('sync-rag-btn');
      btn.disabled = true;
      btn.textContent = 'Sincronizando...';
      try {
        showToast('Sincronizando datos con el RAG...', 'info');
        const result = await api.post('/ai/rag/sync');
        showToast(`✅ Sincronizado: ${result.synced?.clients || 0} clientes, ${result.synced?.pets || 0} mascotas, ${result.synced?.supplies || 0} insumos`, 'success');
      } catch (err) {
        showToast(err.message || 'Error al sincronizar', 'error');
      } finally {
        btn.disabled = false;
        btn.textContent = '🔄 Sincronizar datos';
      }
    });
  } catch (e) {
    content.innerHTML = '<div class="empty-state"><p>Error cargando configuración</p></div>';
  }
}

async function renderSettingsConnectionsContent(content) {
  const data = pageData.settingsConnections || { data: [], meta: { total: 0 } };
  
  content.innerHTML = `
    <div class="page-header">
      <button class="btn btn-primary" id="request-connection-btn">Solicitar Conexión</button>
    </div>
    <div id="connections-list"></div>
  `;
  
  const listEl = document.getElementById('connections-list');
  if (data.data?.length) {
    listEl.innerHTML = `
      <table class="data-table">
        <thead><tr><th>Veterinaria</th><th>Estado</th><th>Acciones</th></tr></thead>
        <tbody>${data.data.map(c => `
          <tr>
            <td>${c.company?.name || '-'}</td>
            <td><span class="badge badge-${c.status === 'ACCEPTED' ? 'success' : 'warning'}">${formatStatus(c.status, 'connection')}</span></td>
            <td>
              ${c.status === 'PENDING' ? `<button class="btn btn-outline btn-sm" data-id="${c.id}" data-action="accept">Aceptar</button>` : ''}
            </td>
          </tr>
        `).join('')}</tbody>
      </table>
    `;

    listEl.querySelectorAll('[data-action="accept"]').forEach(btn => {
      btn.addEventListener('click', async () => {
        try {
          await api.patch(`/connections/${btn.dataset.id}`, { status: 'ACCEPTED' });
          showToast('Conexión aceptada', 'success');
          await loadConnectionsData(pageData.settingsConnections?.page || 1, '');
          renderSettingsConnectionsContent(document.getElementById('settings-content'));
        } catch (e) {
          showToast(e.message || 'Error', 'error');
        }
      });
    });
  } else {
    listEl.innerHTML = '<div class="empty-state"><p>No hay conexiones</p></div>';
  }

  document.getElementById('request-connection-btn')?.addEventListener('click', () => {
    openModal({
      title: 'Solicitar Conexión con otra Clínica',
      content: `
        <div class="form-group">
          <label class="form-label">Buscar empresa por nombre o email</label>
          <input type="text" class="form-input" id="search-company-input" placeholder="Buscar...">
        </div>
        <div id="company-search-results"></div>
      `,
      confirmText: null,
      cancelText: 'Cerrar',
    });

    let searchTimeout;
    document.getElementById('search-company-input')?.addEventListener('input', (e) => {
      clearTimeout(searchTimeout);
      const q = e.target.value.trim();
      if (q.length < 2) return;
      searchTimeout = setTimeout(async () => {
        const resultsEl = document.getElementById('company-search-results');
        if (!resultsEl) return;
        resultsEl.innerHTML = 'Buscando...';
        try {
          const companies = await api.get(`/companies/search?q=${encodeURIComponent(q)}`);
          if (!companies?.length) {
            resultsEl.innerHTML = 'No se encontraron empresas.';
            return;
          }
          resultsEl.innerHTML = companies.map(c => `
            <div style="padding: 8px; border-bottom: 1px solid var(--border); display: flex; justify-content: space-between; align-items: center;">
              <div>
                <strong>${c.name}</strong>
                ${c.email ? `<br><small>${c.email}</small>` : ''}
              </div>
              <button class="btn btn-outline btn-sm" data-company-id="${c.id}" data-company-name="${c.name}">Conectar</button>
            </div>
          `).join('');
          resultsEl.querySelectorAll('button[data-company-id]').forEach(btn => {
            btn.addEventListener('click', async () => {
              btn.disabled = true;
              btn.textContent = 'Enviando...';
              try {
                await api.post('/connections', { companyBId: btn.dataset.companyId });
                showToast(`Solicitud enviada a ${btn.dataset.companyName}`, 'success');
                closeModal();
                await loadConnectionsData(pageData.settingsConnections?.page || 1, '');
                renderSettingsConnectionsContent(document.getElementById('settings-content'));
              } catch (e) {
                showToast(e.message || 'Error al enviar solicitud', 'error');
                btn.disabled = false;
                btn.textContent = 'Conectar';
              }
            });
          });
        } catch (e) {
          resultsEl.innerHTML = `Error: ${e.message}`;
        }
      }, 400);
    });
  });
}