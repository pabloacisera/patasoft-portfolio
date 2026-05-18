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
let cachedUser = null;

async function getOrFetchUser() {
  if (cachedUser) return cachedUser;
  cachedUser = await api.get('/auth/me');
  return cachedUser;
}

function debounce(fn, delay = 300) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

function showImageView(imageUrl) {
  const overlay = document.createElement('div');
  overlay.className = 'image-viewer-overlay';
  overlay.innerHTML = `<img src="${imageUrl}">`;
  overlay.addEventListener('click', () => overlay.remove());
  document.body.appendChild(overlay);
}
window.showImageView = showImageView;

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
  if (!(await ensureDashboardLayout())) return;
  currentPage = 'settings';
  return renderSettingsPage('company');
}

async function ensureDashboardLayout() {
  if (!document.getElementById('page-content')) {
    try {
      const user = await api.get('/auth/me');
      if (!user || !user.companyId) {
        router.navigate('/onboarding');
        return false;
      }
      renderDashboardLayout(user);
    } catch (e) {
      router.navigate('/login');
      return false;
    }
  }
  return true;
}

export async function renderSettingsCompany() {
  if (!(await ensureDashboardLayout())) return;
  return renderSettingsPage('company');
}

export async function renderSettingsSubscription() {
  const isBlocked = !!document.getElementById('blocked-banner');
  if (isBlocked) {
    return renderSubscriptionStandalone();
  }
  if (!(await ensureDashboardLayout())) return;
  return renderSettingsPage('subscription');
}

export async function renderSettingsMercadoPago() {
  if (!(await ensureDashboardLayout())) return;
  return renderSettingsPage('mercadopago');
}

export async function renderSettingsPrices() {
  if (!(await ensureDashboardLayout())) return;
  currentPage = 'settings-prices';
  pageData.priceItems = pageData.priceItems || { page: 1, search: '' };
  await loadPriceItemsData(pageData.priceItems.page, pageData.priceItems.search);
  return renderSettingsPage('prices');
}

export async function renderSettingsAI() {
  if (!(await ensureDashboardLayout())) return;
  return renderSettingsPage('ai');
}

export async function renderSettingsConnections() {
  if (!(await ensureDashboardLayout())) return;
  currentPage = 'settings-connections';
  pageData.settingsConnections = pageData.settingsConnections || { page: 1 };
  await loadConnectionsData(pageData.settingsConnections.page, '');
  return renderSettingsPage('connections');
}

export async function renderExportData() {
  const isBlocked = !!document.getElementById('blocked-banner');
  if (isBlocked) {
    return renderExportDataStandalone();
  }
  if (!(await ensureDashboardLayout())) return;
  renderSettingsPage('export');
}

async function renderExportDataContent(content) {
  content.innerHTML = `
    <div class="settings-section">
      <h3>Exportar mis datos</h3>
      <p style="color: var(--text-secondary); font-size: var(--text-sm); margin-bottom: var(--space-4);">
        Descargá toda la información de tu clínica en un archivo Excel con las siguientes secciones:
      </p>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:var(--space-2);margin-bottom:var(--space-5);font-size:var(--text-sm);color:var(--text-secondary);">
        <span>✓ Clientes</span>
        <span>✓ Mascotas</span>
        <span>✓ Historiales clínicos</span>
        <span>✓ Procedimientos</span>
        <span>✓ Prescripciones</span>
        <span>✓ Pagos</span>
        <span>✓ Items de pago</span>
        <span>✓ Deudas</span>
        <span>✓ Insumos</span>
        <span>✓ Compras</span>
        <span>✓ Movimientos de caja</span>
        <span>✓ Lista de precios</span>
      </div>
      <button class="btn btn-primary" id="btn-export-all" style="padding:12px 32px;font-size:var(--text-base);">
        ⬇ Descargar todo
      </button>
    </div>
  `;

  document.getElementById('btn-export-all')?.addEventListener('click', async () => {
    const btn = document.getElementById('btn-export-all');
    const originalText = btn.textContent;
    btn.disabled = true;
    btn.textContent = 'Generando...';
    try {
      await api.downloadAndSave('/data/export-all', 'mis-datos.xlsx');
      showToast('Descarga completa', 'success');
      btn.disabled = false;
      btn.textContent = originalText;
    } catch (e) {
      showToast(e.message || 'Error al descargar', 'error');
      btn.disabled = false;
      btn.textContent = originalText;
    }
  });
}

async function renderSubscriptionStandalone() {
  const app = document.getElementById('app');
  app.innerHTML = `
    <style>
      body { margin:0; background:#0f172a; color:white; font-family:sans-serif; }
      .sa-wrap { max-width:640px; margin:0 auto; padding:80px 24px 40px; }
      .sa-title { font-size:22px; font-weight:700; margin-bottom:4px; }
      .sa-subtitle { color:#94a3b8; font-size:14px; margin-bottom:24px; }
      .sa-card { background:#1e293b; border:1.5px solid #334155; border-radius:12px; padding:20px; margin-bottom:20px; }
      .sa-card-header { display:flex; align-items:center; justify-content:space-between; margin-bottom:12px; }
      .sa-label { font-size:12px; color:#94a3b8; text-transform:uppercase; letter-spacing:0.05em; }
      .sa-plan-name { font-size:18px; font-weight:700; }
      .sa-badge { display:inline-flex; align-items:center; padding:3px 12px; border-radius:999px; font-size:12px; font-weight:600; }
      .sa-badge-expired { background:rgba(239,68,68,0.15); color:#fca5a5; }
      .sa-badge-trial { background:rgba(245,158,11,0.15); color:#fcd34d; }
      .sa-badge-active { background:rgba(16,185,129,0.15); color:#6ee7b7; }
      .sa-badge-cancelled { background:rgba(107,114,128,0.15); color:#9ca3af; }
      .sa-meta { display:grid; grid-template-columns:repeat(auto-fit,minmax(140px,1fr)); gap:12px; }
      .sa-meta-item { display:flex; flex-direction:column; gap:2px; }
      .sa-meta-label { font-size:11px; color:#64748b; text-transform:uppercase; }
      .sa-meta-value { font-size:14px; font-weight:600; }
      .sa-subtitle2 { font-size:12px; color:#94a3b8; text-transform:uppercase; letter-spacing:0.05em; font-weight:600; margin-bottom:16px; }
      .sa-plans { display:grid; grid-template-columns:repeat(auto-fit,minmax(220px,1fr)); gap:16px; margin-bottom:24px; }
      .sa-plan-card { border:2px solid #334155; border-radius:12px; padding:20px; position:relative; }
      .sa-plan-card.featured { border-color:#4ade80; background:rgba(74,222,128,0.04); }
      .sa-plan-badge { position:absolute; top:-12px; left:50%; transform:translateX(-50%); background:#4ade80; color:#0f172a; font-size:11px; font-weight:700; padding:2px 12px; border-radius:999px; white-space:nowrap; }
      .sa-plan-name2 { font-size:18px; font-weight:700; margin-bottom:4px; }
      .sa-plan-price { font-size:28px; font-weight:800; color:#4ade80; }
      .sa-plan-price span { font-size:13px; font-weight:400; color:#94a3b8; }
      .sa-plan-saving { font-size:11px; color:#6ee7b7; background:rgba(16,185,129,0.1); padding:2px 8px; border-radius:999px; display:inline-block; margin-bottom:12px; }
      .sa-features { list-style:none; padding:0; margin:12px 0; display:flex; flex-direction:column; gap:6px; }
      .sa-features li { font-size:13px; color:#94a3b8; display:flex; align-items:center; gap:6px; }
      .sa-features li::before { content:"✓"; color:#4ade80; font-weight:700; }
      .sa-btn { width:100%; padding:10px 0; border:none; border-radius:8px; font-weight:600; font-size:14px; cursor:pointer; margin-top:8px; }
      .sa-btn-primary { background:#6366f1; color:white; }
      .sa-btn-primary:hover { background:#5558e6; }
      .sa-btn-primary:disabled { opacity:0.5; cursor:default; }
      .sa-btn-secondary { background:#334155; color:#94a3b8; }
      .sa-loading { text-align:center; padding:60px 0; color:#94a3b8; }
    </style>
    <div class="sa-wrap">
      <div class="sa-loading" id="sa-loading">Cargando información de suscripción...</div>
    </div>
  `;

  let sub;
  try {
    sub = await api.get('/subscriptions/status');
  } catch (e) {
    app.innerHTML = `
      <style>body{margin:0;background:#0f172a;color:white;font-family:sans-serif;}</style>
      <div class="sa-wrap"><p style="color:#94a3b8">Error cargando suscripción. Intentá de nuevo.</p></div>
    `;
    return;
  }

  const now = new Date();
  const trialEnd = sub.trialEndsAt ? new Date(sub.trialEndsAt) : null;
  const expireEnd = sub.expiresAt ? new Date(sub.expiresAt) : null;
  const isExpired = ['EXPIRED', 'BLOCKED'].includes(sub.status);
  const isTrial = sub.status === 'TRIAL';
  const isActive = sub.status === 'ACTIVE';
  const isCancelled = sub.status === 'CANCELLED';
  const statusLabels = { TRIAL: 'Prueba gratuita', ACTIVE: 'Activo', EXPIRED: 'Expirado', CANCELLED: 'Cancelado', BLOCKED: 'Bloqueado' };
  const planLabels = { TRIAL: 'Trial', MONTHLY: 'Mensual', YEARLY: 'Anual' };

  app.querySelector('.sa-wrap').innerHTML = `
    <div class="sa-title">Suscripción</div>
    <div class="sa-subtitle">Renová tu plan para recuperar el acceso completo.</div>

    <div class="sa-card">
      <div class="sa-card-header">
        <div>
          <div class="sa-label">Plan actual</div>
          <div class="sa-plan-name">${planLabels[sub.plan] || sub.plan}</div>
        </div>
        <span class="sa-badge ${isExpired ? 'sa-badge-expired' : isTrial ? 'sa-badge-trial' : isActive ? 'sa-badge-active' : 'sa-badge-cancelled'}">
          ${statusLabels[sub.status] || sub.status}
        </span>
      </div>
      <div class="sa-meta">
        ${isTrial && trialEnd ? `
          <div class="sa-meta-item">
            <span class="sa-meta-label">Trial vence</span>
            <span class="sa-meta-value">${formatDate(sub.trialEndsAt)}</span>
          </div>` : ''}
        ${isActive && expireEnd ? `
          <div class="sa-meta-item">
            <span class="sa-meta-label">Próximo vencimiento</span>
            <span class="sa-meta-value">${formatDate(sub.expiresAt)}</span>
          </div>` : ''}
        <div class="sa-meta-item">
          <span class="sa-meta-label">Desde</span>
          <span class="sa-meta-value">${formatDate(sub.startedAt)}</span>
        </div>
      </div>
    </div>

    <div class="sa-subtitle2">Elegí tu plan</div>

    <div class="sa-plans">
      <div class="sa-plan-card">
        <div class="sa-plan-name2">Mensual</div>
        <div class="sa-plan-price">$27.000 <span>/ mes</span></div>
        <ul class="sa-features">
          <li>Clientes y mascotas ilimitados</li>
          <li>Historiales clínicos completos</li>
          <li>Gestión de insumos y stock</li>
          <li>Pagos y deudas</li>
          <li>Chat con IA veterinaria</li>
          <li>Soporte por email</li>
        </ul>
        <button class="sa-btn sa-btn-primary" id="sa-btn-monthly">Suscribirme mensual</button>
      </div>

      <div class="sa-plan-card featured">
        <div class="sa-plan-badge">Recomendado</div>
        <div class="sa-plan-name2">Anual</div>
        <div class="sa-plan-price">$240.000 <span>/ año</span></div>
        <div class="sa-plan-saving">Ahorrás $84.000 vs mensual</div>
        <ul class="sa-features">
          <li>Todo lo del plan mensual</li>
          <li>2 meses gratis</li>
          <li>Conexiones con otras clínicas</li>
          <li>Exportación de reportes PDF</li>
          <li>Soporte prioritario</li>
          <li>Configuración de precios personalizada</li>
        </ul>
        <button class="sa-btn sa-btn-primary" id="sa-btn-yearly">Suscribirme anual</button>
        <button class="sa-btn sa-btn-secondary" id="sa-btn-test" style="margin-top:8px;opacity:0.5;font-size:11px;">[TEST] $150 por 2 días</button>
      </div>
    </div>
  `;

  async function handleSubscribe(plan) {
    const btn = document.getElementById(`sa-btn-${plan}`);
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

  document.getElementById('sa-btn-monthly')?.addEventListener('click', () => handleSubscribe('monthly'));
  document.getElementById('sa-btn-yearly')?.addEventListener('click', () => handleSubscribe('yearly'));
  document.getElementById('sa-btn-test')?.addEventListener('click', () => handleSubscribe('test'));
}

async function renderExportDataStandalone() {
  const app = document.getElementById('app');
  app.innerHTML = `
    <style>
      body { margin:0; background:#0f172a; color:white; font-family:sans-serif; }
      .sa-wrap { max-width:640px; margin:0 auto; padding:80px 24px 40px; }
      .sa-title { font-size:22px; font-weight:700; margin-bottom:4px; }
      .sa-subtitle { color:#94a3b8; font-size:14px; margin-bottom:24px; }
      .sa-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(150px,1fr)); gap:8px; margin-bottom:24px; }
      .sa-grid span { font-size:13px; color:#94a3b8; }
      .sa-btn-dl { background:#6366f1; color:white; padding:12px 32px; border:none; border-radius:8px; font-weight:600; font-size:15px; cursor:pointer; }
      .sa-btn-dl:hover { background:#5558e6; }
      .sa-btn-dl:disabled { opacity:0.5; cursor:default; }
    </style>
    <div class="sa-wrap">
      <div class="sa-title">Exportar mis datos</div>
      <div class="sa-subtitle">Descargá toda la información de tu clínica en un archivo Excel.</div>
      <div class="sa-grid">
        <span>✓ Clientes</span>
        <span>✓ Mascotas</span>
        <span>✓ Historiales clínicos</span>
        <span>✓ Procedimientos</span>
        <span>✓ Prescripciones</span>
        <span>✓ Pagos</span>
        <span>✓ Items de pago</span>
        <span>✓ Deudas</span>
        <span>✓ Insumos</span>
        <span>✓ Compras</span>
        <span>✓ Movimientos de caja</span>
        <span>✓ Lista de precios</span>
      </div>
      <button class="sa-btn-dl" id="sa-btn-export">⬇ Descargar todo</button>
    </div>
  `;

  document.getElementById('sa-btn-export')?.addEventListener('click', async () => {
    const btn = document.getElementById('sa-btn-export');
    const originalText = btn.textContent;
    btn.disabled = true;
    btn.textContent = 'Generando...';
    try {
      await api.downloadAndSave('/data/export-all', 'mis-datos.xlsx');
      showToast('Descarga completa', 'success');
      btn.disabled = false;
      btn.textContent = originalText;
    } catch (e) {
      showToast(e.message || 'Error al descargar', 'error');
      btn.disabled = false;
      btn.textContent = originalText;
    }
  });
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

function setupNavListeners() {
  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      const page = item.dataset.page;
      
      if (page === 'logout') {
        cachedUser = null;
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
        'cash-register': 'Caja',
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
      font-size: 14px; font-weight: 500; position: relative; z-index: 10;
      border-bottom: 1px solid rgba(0,0,0,0.1);
    `;
    banner.innerHTML = `
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
    `;
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
    case 'cash-register': await renderCashRegister(); break;
    case 'settings': router.navigate('/settings/company'); break;
    default: content.innerHTML = '<div class="empty-state"><p>Pagina no encontrada</p></div>';
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
        <div class="stat-card-value">${clientsCount}</div>
        <div class="stat-card-label">Clientes</div>
      </div>
      <div class="stat-card" onclick="window.location.href='/dashboard/pets'" style="cursor:pointer">
        <div class="stat-card-value">${petsCount}</div>
        <div class="stat-card-label">Mascotas</div>
      </div>
      <div class="stat-card" onclick="window.location.href='/dashboard/payments'" style="cursor:pointer">
        <div class="stat-card-value">${formatCurrency(totalDebt)}</div>
        <div class="stat-card-label">Deuda Total</div>
      </div>
      <div class="stat-card" onclick="window.location.href='/dashboard/supplies'" style="cursor:pointer">
        <div class="stat-card-value">${lowStockCount}</div>
        <div class="stat-card-label">Insumos Bajos</div>
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
            <td>
              <button class="btn btn-outline btn-sm" data-id="${c.id}" data-action="view">Ver</button>
              <button class="btn btn-outline btn-sm" data-id="${c.id}" data-action="edit">Editar</button>
              <button class="btn btn-danger btn-sm" data-id="${c.id}" data-action="delete">Eliminar</button>
            </td>
          </tr>
        `).join('')}</tbody>
      </table>
    `;
    
    listEl.querySelectorAll('[data-action="view"]').forEach(btn => {
      btn.addEventListener('click', () => showClientDetail(btn.dataset.id));
    });
    
    listEl.querySelectorAll('[data-action="edit"]').forEach(btn => {
      btn.addEventListener('click', () => showEditClientModal(btn.dataset.id));
    });
    
    listEl.querySelectorAll('[data-action="delete"]').forEach(btn => {
      btn.addEventListener('click', () => deleteClient(btn.dataset.id));
    });
  } else {
    listEl.innerHTML = '<div class="empty-state"><p>No hay clientes</p></div>';
  }
  
  const paginationEl = document.getElementById('clients-pagination');
  if (data.meta?.totalPages > 1) {
    const pagination = createPagination({
      total: data.meta.total,
      page: data.page || 1,
      limit: 20,
      onPageChange: async (newPage) => {
        await loadClientsData(newPage, pageData.clients?.search || '');
        renderClientsPage(document.getElementById('page-content'));
      }
    });
    paginationEl.appendChild(pagination);
  }
  
  document.getElementById('add-client-btn')?.addEventListener('click', () => showClientModal());
}

function showClientDetail(clientId) {
  const client = pageData.clients?.data?.find(c => c.id === clientId);
  if (!client) return;
  
  openModal({
    title: `Cliente: ${client.name} ${client.lastName || ''}`,
    size: 'lg',
    content: `
      <div class="detail-row"><span>DNI:</span><span>${client.dni || '-'}</span></div>
      <div class="detail-row"><span>Email:</span><span>${client.email || '-'}</span></div>
      <div class="detail-row"><span>Teléfono:</span><span>${client.phone || '-'}</span></div>
      <div class="detail-row"><span>Dirección:</span><span>${client.address || '-'}</span></div>
      <hr style="margin:16px 0">
      <h4 style="margin-bottom:8px">Mascotas</h4>
      <div id="client-pets-list">Cargando...</div>
      <div id="client-last-consultation" style="margin-top:12px"></div>
    `,
    showCancel: false,
    confirmText: 'Cerrar',
  });
  
  api.get(`/clients/${clientId}/pets`).then(pets => {
    const el = document.getElementById('client-pets-list');
    if (!el) return;
    if (pets?.length) {
      el.innerHTML = pets.map(p => 
        `<div class="detail-row"><span>${p.name}</span><span>${p.species || ''} ${p.breed || ''}</span></div>`
      ).join('');
    } else {
      el.innerHTML = '<div style="color:var(--text-secondary);font-size:var(--text-sm)">No tiene mascotas registradas</div>';
    }
  }).catch(() => {
    const el = document.getElementById('client-pets-list');
    if (el) el.innerHTML = '<div style="color:var(--text-secondary);font-size:var(--text-sm)">Error cargando mascotas</div>';
  });
}

function showClientModal(clientId) {
  const isEdit = !!clientId;
  const client = isEdit ? pageData.clients?.data?.find(c => c.id === clientId) : null;
  
  openModal({
    title: isEdit ? 'Editar Cliente' : 'Nuevo Cliente',
    content: `
      <div class="form-group">
        <label class="form-label required">Nombre</label>
        <input type="text" class="form-input" id="client-name" value="${client?.name || ''}">
      </div>
      <div class="form-group">
        <label class="form-label">Apellido</label>
        <input type="text" class="form-input" id="client-lastName" value="${client?.lastName || ''}">
      </div>
      <div class="form-group">
        <label class="form-label">DNI</label>
        <input type="text" class="form-input" id="client-dni" value="${client?.dni || ''}">
      </div>
      <div class="form-group">
        <label class="form-label">Email</label>
        <input type="email" class="form-input" id="client-email" value="${client?.email || ''}">
      </div>
      <div class="form-group">
        <label class="form-label">Teléfono</label>
        <input type="tel" class="form-input" id="client-phone" value="${client?.phone || ''}">
      </div>
      <div class="form-group">
        <label class="form-label">Dirección</label>
        <input type="text" class="form-input" id="client-address" value="${client?.address || ''}">
      </div>
    `,
    confirmText: isEdit ? 'Guardar' : 'Crear',
    onConfirm: async () => {
      const name = document.getElementById('client-name').value.trim();
      if (!name) {
        showFieldError('client-name', 'El nombre es requerido');
        return false;
      }
      
      try {
        const payload = {
          name,
          lastName: document.getElementById('client-lastName').value.trim(),
          dni: document.getElementById('client-dni').value.trim(),
          email: document.getElementById('client-email').value.trim(),
          phone: document.getElementById('client-phone').value.trim(),
          address: document.getElementById('client-address').value.trim(),
        };
        
        if (isEdit) {
          await api.patch(`/clients/${clientId}`, payload);
          showToast('Cliente actualizado', 'success');
        } else {
          await api.post('/clients', payload);
          showToast('Cliente creado', 'success');
        }
        
        await loadClientsData(pageData.clients?.page || 1, pageData.clients?.search || '');
        renderClientsPage(document.getElementById('page-content'));
      } catch (e) {
        showToast(e.message || 'Error guardando cliente', 'error');
        return false;
      }
    }
  });
}

function showEditClientModal(clientId) {
  showClientModal(clientId);
}

async function deleteClient(clientId) {
  const confirmed = window.confirm('¿Estás seguro de eliminar este cliente?');
  if (!confirmed) return;
  
  try {
    await api.delete(`/clients/${clientId}`);
    showToast('Cliente eliminado', 'success');
    await loadClientsData(pageData.clients?.page || 1, pageData.clients?.search || '');
    renderClientsPage(document.getElementById('page-content'));
  } catch (e) {
    showToast(e.message || 'Error eliminando cliente', 'error');
  }
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
        <thead><tr><th>Nombre</th><th>Especie</th><th>Raza</th><th>Dueño</th><th>Acciones</th></tr></thead>
        <tbody>${data.data.map(p => `
          <tr>
            <td>${p.name}</td>
            <td>${formatSpecies(p.species)}</td>
            <td>${p.breed || '-'}</td>
            <td>${p.client?.name || '<span style="color:var(--text-secondary)">Sin dueño</span>'}</td>
            <td>
              <button class="btn btn-outline btn-sm" data-id="${p.id}" data-action="view-pet">Ver</button>
              <button class="btn btn-outline btn-sm" data-id="${p.id}" data-action="edit-pet">Editar</button>
              <button class="btn btn-danger btn-sm" data-id="${p.id}" data-action="delete-pet">Eliminar</button>
            </td>
          </tr>
        `).join('')}</tbody>
      </table>
    `;
    
    listEl.querySelectorAll('[data-action="view-pet"]').forEach(btn => {
      btn.addEventListener('click', () => showPetDetail(btn.dataset.id));
    });
    listEl.querySelectorAll('[data-action="edit-pet"]').forEach(btn => {
      btn.addEventListener('click', () => showPetModal(btn.dataset.id));
    });
    listEl.querySelectorAll('[data-action="delete-pet"]').forEach(btn => {
      btn.addEventListener('click', () => deletePet(btn.dataset.id));
    });
  } else {
    listEl.innerHTML = '<div class="empty-state"><p>No hay mascotas</p></div>';
  }
  
  const paginationEl = document.getElementById('pets-pagination');
  if (data.meta?.totalPages > 1) {
    const pagination = createPagination({
      total: data.meta.total,
      page: data.page || 1,
      limit: 20,
      onPageChange: async (newPage) => {
        await loadPetsData(newPage, pageData.pets?.search || '');
        renderPetsPage(document.getElementById('page-content'));
      }
    });
    paginationEl.appendChild(pagination);
  }
  
  document.getElementById('add-pet-btn')?.addEventListener('click', showAddPetModal);
}

function showPetDetail(petId) {
  const pet = pageData.pets?.data?.find(p => p.id === petId);
  if (!pet) return;
  
  openModal({
    title: `Mascota: ${pet.name}`,
    size: 'lg',
    content: `
      <div class="detail-row"><span>Nombre:</span><span>${pet.name}</span></div>
      <div class="detail-row"><span>Especie:</span><span>${formatSpecies(pet.species)}</span></div>
      <div class="detail-row"><span>Raza:</span><span>${pet.breed || '-'}</span></div>
      <div class="detail-row"><span>Género:</span><span>${pet.gender ? formatGender(pet.gender) : '-'}</span></div>
      <div class="detail-row"><span>Peso:</span><span>${pet.weight ? pet.weight + ' kg' : '-'}</span></div>
      <div class="detail-row"><span>Color:</span><span>${pet.color || '-'}</span></div>
      <div class="detail-row"><span>Dueño:</span><span>${pet.client?.name || 'Sin dueño'}</span></div>
      <hr style="margin:16px 0">
      <h4 style="margin-bottom:8px">Fotos</h4>
      <div id="pet-photos-list">Cargando...</div>
      <div style="margin-top:8px">
        <input type="file" id="pet-photo-input" accept="image/*" style="display:none">
        <button class="btn btn-outline btn-sm" id="upload-pet-photo-btn">+ Subir foto</button>
        <span style="font-size:var(--text-xs);color:var(--text-secondary);margin-left:8px">Máximo 5 fotos</span>
      </div>
    `,
    showCancel: false,
    confirmText: 'Cerrar',
  });
  
  api.get(`/pets/${petId}`).then(fullPet => {
    const photosEl = document.getElementById('pet-photos-list');
    if (!photosEl) return;
    
    const photos = fullPet.photos || [];
    if (photos.length) {
      photosEl.innerHTML = `
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          ${photos.map(ph => `
            <div style="position:relative;width:80px;height:80px">
              <img src="${ph.cloudinaryUrl}" style="width:100%;height:100%;object-fit:cover;border-radius:var(--radius);cursor:pointer" onclick="window.showImageView && window.showImageView('${ph.cloudinaryUrl}')">
              <button class="btn btn-danger btn-sm" style="position:absolute;top:2px;right:2px;padding:2px 6px;font-size:10px" data-photo-id="${ph.id}" data-pet-id="${petId}" data-action="delete-photo">X</button>
            </div>
          `).join('')}
        </div>
      `;
      photosEl.querySelectorAll('[data-action="delete-photo"]').forEach(btn => {
        btn.addEventListener('click', async () => {
          if (!window.confirm('¿Eliminar esta foto?')) return;
          try {
            await api.delete(`/pets/${petId}/photos/${btn.dataset.photoId}`);
            showToast('Foto eliminada', 'success');
            showPetDetail(petId);
          } catch (e) {
            showToast(e.message || 'Error', 'error');
          }
        });
      });
    } else {
      photosEl.innerHTML = '<div style="color:var(--text-secondary);font-size:var(--text-sm)">No hay fotos</div>';
    }
  }).catch(() => {
    const photosEl = document.getElementById('pet-photos-list');
    if (photosEl) photosEl.innerHTML = '<div style="color:var(--text-secondary);font-size:var(--text-sm)">Error cargando fotos</div>';
  });
  
  document.getElementById('upload-pet-photo-btn')?.addEventListener('click', () => {
    document.getElementById('pet-photo-input')?.click();
  });
  
  document.getElementById('pet-photo-input')?.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    try {
      showToast('Subiendo foto...', 'info');
      const formData = new FormData();
      formData.append('file', file);
      await api.postForm(`/pets/${petId}/photos`, formData);
      showToast('Foto subida', 'success');
      showPetDetail(petId);
    } catch (err) {
      showToast(err.message || 'Error subiendo foto', 'error');
    }
    e.target.value = '';
  });
}

async function deletePet(petId) {
  if (!window.confirm('¿Estás seguro de eliminar esta mascota?')) return;
  try {
    await api.delete(`/pets/${petId}`);
    showToast('Mascota eliminada', 'success');
    await loadPetsData(pageData.pets?.page || 1, pageData.pets?.search || '');
    renderPetsPage(document.getElementById('page-content'));
  } catch (e) {
    showToast(e.message || 'Error eliminando mascota', 'error');
  }
}

function showAddPetModal() {
  showPetModal(null);
}

function showPetModal(petId) {
  const isEdit = !!petId;
  const pet = isEdit ? pageData.pets?.data?.find(p => p.id === petId) : null;
  let clientsCache = [];
  
  api.get('/clients?limit=200').then(r => {
    clientsCache = r.data || [];
    const sel = document.getElementById('pet-clientId');
    if (sel) {
      sel.innerHTML = '<option value="">Sin dueño (mascota callejera)</option>' +
        clientsCache.map(c => `<option value="${c.id}" ${c.id === pet?.clientId ? 'selected' : ''}>${c.name} ${c.lastName || ''}</option>`).join('');
    }
  }).catch(() => {});
  
  openModal({
    title: isEdit ? `Editar: ${pet?.name || 'Mascota'}` : 'Nueva Mascota',
    content: `
      <div class="form-group">
        <label class="form-label">Dueño</label>
        <select class="form-input" id="pet-clientId">
          <option value="">Sin dueño (mascota callejera)</option>
        </select>
      </div>
      <div class="form-row" style="display:flex;gap:12px">
        <div class="form-group" style="flex:1">
          <label class="form-label required">Nombre</label>
          <input type="text" class="form-input" id="pet-name" value="${pet?.name || ''}">
        </div>
        <div class="form-group" style="flex:1">
          <label class="form-label required">Especie</label>
          <select class="form-input" id="pet-species">
            <option value="">Seleccionar...</option>
            <option value="DOG" ${pet?.species === 'DOG' ? 'selected' : ''}>Perro</option>
            <option value="CAT" ${pet?.species === 'CAT' ? 'selected' : ''}>Gato</option>
            <option value="HORSE" ${pet?.species === 'HORSE' ? 'selected' : ''}>Caballo</option>
            <option value="BIRD" ${pet?.species === 'BIRD' ? 'selected' : ''}>Ave</option>
            <option value="RABBIT" ${pet?.species === 'RABBIT' ? 'selected' : ''}>Conejo</option>
            <option value="REPTILE" ${pet?.species === 'REPTILE' ? 'selected' : ''}>Reptil</option>
            <option value="OTHER" ${pet?.species === 'OTHER' ? 'selected' : ''}>Otro</option>
          </select>
        </div>
      </div>
      <div class="form-row" style="display:flex;gap:12px">
        <div class="form-group" style="flex:1">
          <label class="form-label">Raza</label>
          <input type="text" class="form-input" id="pet-breed" value="${pet?.breed || ''}">
        </div>
        <div class="form-group" style="flex:1">
          <label class="form-label">Género</label>
          <select class="form-input" id="pet-gender">
            <option value="">Seleccionar...</option>
            <option value="MALE" ${pet?.gender === 'MALE' ? 'selected' : ''}>Macho</option>
            <option value="FEMALE" ${pet?.gender === 'FEMALE' ? 'selected' : ''}>Hembra</option>
          </select>
        </div>
      </div>
      <div class="form-row" style="display:flex;gap:12px">
        <div class="form-group" style="flex:1">
          <label class="form-label">Fecha de Nacimiento</label>
          <input type="date" class="form-input" id="pet-birthDate" value="${pet?.birthDate ? pet.birthDate.split('T')[0] : ''}">
        </div>
        <div class="form-group" style="flex:1">
          <label class="form-label">Peso (kg)</label>
          <input type="number" step="0.01" class="form-input" id="pet-weight" value="${pet?.weight || ''}">
        </div>
        <div class="form-group" style="flex:1">
          <label class="form-label">Color</label>
          <input type="text" class="form-input" id="pet-color" value="${pet?.color || ''}">
        </div>
      </div>
      <div class="form-row" style="display:flex;gap:12px">
        <div class="form-group" style="flex:1">
          <label class="form-label">Microchip</label>
          <input type="text" class="form-input" id="pet-microchip" value="${pet?.microchipId || ''}">
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Notas</label>
        <textarea class="form-input" id="pet-notes" rows="2">${pet?.notes || ''}</textarea>
      </div>
    `,
    confirmText: isEdit ? 'Guardar' : 'Crear',
    onConfirm: async () => {
      const name = document.getElementById('pet-name').value.trim();
      const species = document.getElementById('pet-species').value;
      
      if (!name || !species) {
        showToast('Nombre y especie son requeridos', 'error');
        return false;
      }
      
      try {
        const payload = {
          name,
          species,
          clientId: document.getElementById('pet-clientId').value || undefined,
          breed: document.getElementById('pet-breed').value.trim(),
          gender: document.getElementById('pet-gender').value,
          birthDate: document.getElementById('pet-birthDate').value || undefined,
          weight: parseFloat(document.getElementById('pet-weight').value) || undefined,
          color: document.getElementById('pet-color').value.trim(),
          microchipId: document.getElementById('pet-microchip').value.trim(),
          notes: document.getElementById('pet-notes').value.trim(),
        };
        
        if (isEdit) {
          await api.patch(`/pets/${petId}`, payload);
          showToast('Mascota actualizada', 'success');
        } else {
          await api.post('/pets', payload);
          showToast('Mascota creada', 'success');
        }
        
        await loadPetsData(pageData.pets?.page || 1, pageData.pets?.search || '');
        renderPetsPage(document.getElementById('page-content'));
      } catch (e) {
        showToast(e.message || 'Error guardando mascota', 'error');
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
            <td>
              <button class="btn btn-outline btn-sm" data-id="${r.id}" data-action="view">Ver</button>
              <button class="btn btn-outline btn-sm" data-id="${r.id}" data-action="edit">Editar</button>
              <button class="btn btn-outline btn-sm" data-id="${r.id}" data-action="download-record-pdf" title="Descargar receta médica">📄 Receta</button>
              <button class="btn btn-danger btn-sm" data-id="${r.id}" data-action="delete">Eliminar</button>
            </td>
          </tr>
        `).join('')}</tbody>
      </table>
    `;
    
    listEl.querySelectorAll('[data-action="view"]').forEach(btn => {
      btn.addEventListener('click', () => showViewRecordModal(btn.dataset.id));
    });

    listEl.querySelectorAll('[data-action="download-record-pdf"]').forEach(btn => {
      btn.addEventListener('click', async () => {
        try {
          const blob = await api.getBlob(`/medical-records/${btn.dataset.id}/pdf`);
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `consulta-${btn.dataset.id.slice(-6)}.pdf`;
          a.click();
          URL.revokeObjectURL(url);
        } catch (e) {
          showToast('Error al generar el PDF', 'error');
        }
      });
    });
    
    listEl.querySelectorAll('[data-action="edit"]').forEach(btn => {
      btn.addEventListener('click', () => showEditRecordModal(btn.dataset.id));
    });
    
    listEl.querySelectorAll('[data-action="delete"]').forEach(btn => {
      btn.addEventListener('click', () => deleteRecord(btn.dataset.id));
    });
  } else {
    listEl.innerHTML = '<div class="empty-state"><p>No hay historial médico</p></div>';
  }
  
  const paginationEl = document.getElementById('records-pagination');
  if (data.meta?.totalPages > 1) {
    const pagination = createPagination({
      total: data.meta.total,
      page: data.page || 1,
      limit: 20,
      onPageChange: async (newPage) => {
        await loadMedicalRecordsData(newPage, pageData.medicalRecords?.petId || '');
        renderMedicalRecordsPage(document.getElementById('page-content'));
      }
    });
    paginationEl.appendChild(pagination);
  }
  
  document.getElementById('add-record-btn')?.addEventListener('click', showAddRecordModal);
}

function showViewRecordModal(recordId) {
  const record = pageData.medicalRecords?.data?.find(r => r.id === recordId);
  if (!record) return;
  
  openModal({
    title: `Consulta: ${record.pet?.name || 'Mascota'} - ${formatDate(record.date)}`,
    size: 'lg',
    content: `
      <div class="detail-row"><span>Fecha:</span><span>${formatDate(record.date)}</span></div>
      <div class="detail-row"><span>Mascota:</span><span>${record.pet?.name || '-'}</span></div>
      <div class="detail-row"><span>Motivo:</span><span>${record.visitReason}</span></div>
      <div class="detail-row"><span>Diagnóstico:</span><span>${record.diagnosis || '-'}</span></div>
      <div class="detail-row"><span>Tratamiento:</span><span>${record.treatment || '-'}</span></div>
      <div class="detail-row"><span>Observaciones:</span><span>${record.observations || '-'}</span></div>
      <div class="detail-row"><span>Peso:</span><span>${record.weight || '-'}</span></div>
      <div class="detail-row"><span>Temperatura:</span><span>${record.temperature ? record.temperature + '°C' : '-'}</span></div>
      <div class="detail-row"><span>Próxima visita:</span><span>${record.nextVisitDate ? formatDate(record.nextVisitDate) : '-'}</span></div>
      ${record.payment ? `
        <hr>
        <h4>Pago asociado</h4>
        <div class="detail-row"><span>Total:</span><span>${formatCurrency(record.payment.totalAmount)}</span></div>
        <div class="detail-row"><span>Estado:</span><span>${formatStatus(record.payment.status, 'payment')}</span></div>
        <div class="detail-row"><span>Método:</span><span>${record.payment.method || '-'}</span></div>
      ` : ''}
        ${record.prescriptions?.length ? `
        <hr>
        <h4>Prescripciones</h4>
        ${record.prescriptions.map(p => {
          const doseStr = p.dose ? p.dose : '';
          const qtyStr = (p.doseQuantity && p.doseQuantity > 0) ? p.doseQuantity : '';
          const unitStr = p.doseUnit ? p.doseUnit : '';
          const parts = [doseStr, qtyStr, unitStr].filter(Boolean).join(' ');
          const freqDur = [p.frequency, p.duration].filter(Boolean).join(' - ');
          const detail = [parts, freqDur].filter(Boolean).join(' | ');
          return `<div class="detail-row"><span>${p.medicineName}</span><span>${detail || '-'}</span></div>`;
        }).join('')}
      ` : ''}
      ${record.procedures?.length ? `
        <hr>
        <h4>Procedimientos</h4>
        ${record.procedures.map(p => `<div class="detail-row"><span>${p.name}</span><span>${p.priceItem?.name || ''}</span></div>`).join('')}
      ` : ''}
      <hr>
      <div style="display:flex;gap:8px;margin-top:12px">
        <button class="btn btn-primary btn-sm" id="download-prescription-btn">📄 Descargar Receta</button>
        ${record.payment?.id ? `<button class="btn btn-outline btn-sm" id="download-receipt-btn">🧾 Descargar Recibo</button>` : ''}
      </div>
    `,
    showCancel: false,
    confirmText: 'Cerrar',
  });
  
  setTimeout(() => {
    const prescBtn = document.getElementById('download-prescription-btn');
    if (prescBtn) {
      prescBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        try {
          const blob = await api.getBlob(`/medical-records/${recordId}/pdf`);
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `receta-${recordId.slice(-6)}.pdf`;
          a.click();
          URL.revokeObjectURL(url);
        } catch (e) {
          showToast('Error al generar la receta', 'error');
        }
      });
    }
    const receiptBtn = document.getElementById('download-receipt-btn');
    if (receiptBtn) {
      receiptBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        try {
          const blob = await api.getBlob(`/payments/${record.payment.id}/receipt`);
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `recibo-${record.payment.id.slice(-6)}.pdf`;
          a.click();
          URL.revokeObjectURL(url);
        } catch (e) {
          showToast('Error al generar el recibo', 'error');
        }
      });
    }
  }, 100);
}

function showEditRecordModal(recordId) {
  const record = pageData.medicalRecords?.data?.find(r => r.id === recordId);
  if (!record) return;
  
  openModal({
    title: 'Editar Consulta',
    content: `
      <div class="form-group">
        <label class="form-label required">Mascota</label>
        <select class="form-input" id="edit-record-petId"></select>
      </div>
      <div class="form-group">
        <label class="form-label required">Fecha</label>
        <input type="date" class="form-input" id="edit-record-date" value="${record.date ? record.date.split('T')[0] : ''}">
      </div>
      <div class="form-group">
        <label class="form-label required">Motivo de consulta</label>
        <input type="text" class="form-input" id="edit-record-reason" value="${record.visitReason || ''}">
      </div>
      <div class="form-group">
        <label class="form-label">Diagnóstico</label>
        <textarea class="form-input" id="edit-record-diagnosis" rows="3">${record.diagnosis || ''}</textarea>
      </div>
      <div class="form-group">
        <label class="form-label">Tratamiento</label>
        <textarea class="form-input" id="edit-record-treatment" rows="3">${record.treatment || ''}</textarea>
      </div>
      <div class="form-group">
        <label class="form-label">Observaciones</label>
        <textarea class="form-input" id="edit-record-observations" rows="2">${record.observations || ''}</textarea>
      </div>
    `,
    onConfirm: async () => {
      const petId = document.getElementById('edit-record-petId').value;
      const reason = document.getElementById('edit-record-reason').value.trim();
      const date = document.getElementById('edit-record-date').value;
      
      if (!petId || !reason || !date) {
        showToast('Los campos marcados con * son requeridos', 'error');
        return false;
      }
      
      try {
        await api.patch(`/medical-records/${recordId}`, {
          petId,
          date: new Date(date).toISOString(),
          visitReason: reason,
          diagnosis: document.getElementById('edit-record-diagnosis').value.trim(),
          treatment: document.getElementById('edit-record-treatment').value.trim(),
          observations: document.getElementById('edit-record-observations').value.trim(),
        });
        
        showToast('Consulta actualizada', 'success');
        await loadMedicalRecordsData(pageData.medicalRecords?.page || 1, pageData.medicalRecords?.petId || '');
        renderMedicalRecordsPage(document.getElementById('page-content'));
      } catch (e) {
        showToast(e.message || 'Error actualizando consulta', 'error');
        return false;
      }
    }
  });
  
  api.get('/pets').then(({ data }) => {
    const select = document.getElementById('edit-record-petId');
    if (select && data?.length) {
      select.innerHTML = '<option value="">Seleccionar...</option>' +
        data.map(p => `<option value="${p.id}" ${p.id === record.petId ? 'selected' : ''}>${p.name}</option>`).join('');
    }
  }).catch(() => {});
}

async function deleteRecord(recordId) {
  const confirmed = window.confirm('¿Estás seguro de eliminar esta consulta?');
  if (!confirmed) return;
  
  try {
    await api.delete(`/medical-records/${recordId}`);
    showToast('Consulta eliminada', 'success');
    await loadMedicalRecordsData(pageData.medicalRecords?.page || 1, pageData.medicalRecords?.petId || '');
    renderMedicalRecordsPage(document.getElementById('page-content'));
  } catch (e) {
    showToast(e.message || 'Error eliminando consulta', 'error');
  }
}

function showAddRecordModal() {
  let suppliesCache = [];
  let priceItemsCache = [];
  let allPetsCache = [];
  
  Promise.all([
    api.get('/supplies?limit=200').catch(() => ({ data: [] })),
    api.get('/price-items?limit=200').catch(() => ({ data: [] })),
    api.get('/pets?limit=200').catch(() => ({ data: [] })),
  ]).then(([suppRes, priceRes, petsRes]) => {
    suppliesCache = suppRes.data || [];
    priceItemsCache = priceRes.data || [];
    allPetsCache = petsRes.data || [];
    
    const petSelect = document.getElementById('record-petId');
    if (petSelect) {
      petSelect.innerHTML = '<option value="">Seleccionar...</option>' +
        allPetsCache.map(p => {
          const owner = p.client ? ` (${p.client.name})` : ' (Sin dueño)';
          return `<option value="${p.id}">${p.name}${owner}</option>`;
        }).join('');
    }
  });
  
  openModal({
    title: 'Nueva Consulta',
    size: 'xl',
    content: `
      <style>
        .record-section { margin-bottom: var(--space-4); border: 1px solid var(--border); border-radius: var(--radius-lg); padding: var(--space-4); }
        .record-section-title { font-weight: 600; font-size: var(--text-base); margin-bottom: var(--space-3); display:flex; justify-content:space-between; align-items:center; }
        .row-item { background: var(--bg); border: 1px solid var(--border); border-radius: var(--radius); padding: var(--space-3); margin-bottom: var(--space-2); position: relative; }
        .autocomplete-dropdown { position: absolute; background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); max-height: 180px; overflow-y: auto; z-index: 100; width: 100%; box-shadow: var(--shadow-lg); left: 0; top: 100%; }
        .ac-option { padding: 6px 10px; cursor: pointer; font-size: var(--text-sm); display: flex; justify-content: space-between; }
        .ac-option:hover { background: var(--bg); }
        .section-desc { font-size: var(--text-xs); color: var(--text-secondary); margin-bottom: var(--space-3); }
      </style>
      <div class="record-section">
        <div class="record-section-title">Datos de la Consulta</div>
        <div class="form-row">
          <div class="form-group" style="flex:1">
            <label class="form-label required">Mascota</label>
            <select class="form-input" id="record-petId"></select>
          </div>
          <div class="form-group" style="flex:1">
            <label class="form-label required">Fecha</label>
            <input type="datetime-local" class="form-input" id="record-date" value="${new Date().toISOString().slice(0,16)}">
          </div>
        </div>
        <div class="form-group">
          <label class="form-label required">Motivo de consulta</label>
          <input type="text" class="form-input" id="record-reason">
        </div>
        <div class="form-row">
          <div class="form-group" style="flex:1">
            <label class="form-label">Diagnóstico</label>
            <textarea class="form-input" id="record-diagnosis" rows="2"></textarea>
          </div>
          <div class="form-group" style="flex:1">
            <label class="form-label">Tratamiento</label>
            <textarea class="form-input" id="record-treatment" rows="2"></textarea>
          </div>
        </div>
        <div class="form-row">
          <div class="form-group" style="flex:1">
            <label class="form-label">Peso (kg)</label>
            <input type="number" class="form-input" id="record-weight" step="0.1">
          </div>
          <div class="form-group" style="flex:1">
            <label class="form-label">Temperatura (°C)</label>
            <input type="number" class="form-input" id="record-temperature" step="0.1">
          </div>
          <div class="form-group" style="flex:1">
            <label class="form-label">Próxima visita</label>
            <input type="date" class="form-input" id="record-nextVisit">
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">Observaciones</label>
          <textarea class="form-input" id="record-observations" rows="2"></textarea>
        </div>
      </div>
      
      <div class="record-section">
        <div class="record-section-title">
          Procedimientos
          <button type="button" class="btn btn-outline btn-sm" id="add-procedure-btn">+ Procedimiento</button>
        </div>
        <p class="section-desc">Servicios y estudios realizados. Se cargan desde la lista de precios si están configurados.</p>
        <div id="procedures-container"></div>
      </div>
      
      <div class="record-section">
        <div class="record-section-title">
          Insumos a Cobrar
          <button type="button" class="btn btn-outline btn-sm" id="add-supply-item-btn">+ Insumo</button>
        </div>
        <p class="section-desc">Productos e insumos utilizados en la consulta. Se cobran al cliente.</p>
        <div id="supply-items-container"></div>
      </div>
      
      <div class="record-section">
        <div class="record-section-title">
          Prescripciones Médicas
          <button type="button" class="btn btn-outline btn-sm" id="add-prescription-btn">+ Medicamento</button>
        </div>
        <p class="section-desc">Instructivo médico: medicamento, dosis, frecuencia y duración del tratamiento.</p>
        <div id="prescriptions-container"></div>
      </div>
      
      <div class="record-section">
        <div class="record-section-title">Cobro</div>
        <div class="form-row">
          <div class="form-group" style="flex:1">
            <label class="form-label">Método de cobro</label>
            <select class="form-input" id="record-payment-method">
              <option value="">Sin cobro (solo consulta)</option>
              <option value="CASH">Efectivo</option>
              <option value="TRANSFER">Transferencia</option>
              <option value="MP_QR">MercadoPago QR</option>
              <option value="MP_CHECKOUT">MercadoPago Checkout</option>
              <option value="CHECK">Cheque</option>
              <option value="OTHER">Otro</option>
            </select>
          </div>
          <div class="form-group" style="flex:1">
            <label class="form-label">Estado</label>
            <select class="form-input" id="record-payment-status">
              <option value="PENDING">Pendiente</option>
              <option value="PAID">Pagado</option>
              <option value="DEFERRED">Diferido</option>
            </select>
          </div>
          <div class="form-group" style="flex:1">
            <label class="form-label">Vencimiento</label>
            <input type="date" class="form-input" id="record-payment-dueDate">
          </div>
        </div>
        <div class="form-row" style="margin-top:var(--space-2)">
          <div class="form-group" style="flex:1">
            <label class="form-label">Total estimado</label>
            <input type="text" class="form-input" id="record-payment-total" readonly value="$0.00" style="font-weight:700">
          </div>
          <div class="form-group" style="flex:2">
            <label class="form-label">Notas</label>
            <input type="text" class="form-input" id="record-payment-notes">
          </div>
        </div>
      </div>
    `,
    confirmText: 'Guardar Consulta',
    onConfirm: async () => {
      const petId = document.getElementById('record-petId').value;
      const reason = document.getElementById('record-reason').value.trim();
      const date = document.getElementById('record-date').value;
      
      if (!petId || !reason || !date) {
        showToast('Los campos marcados con * son requeridos', 'error');
        return false;
      }
      
      // Collect prescriptions (medical only)
      const prescriptions = [];
      document.querySelectorAll('.prescription-row').forEach(row => {
        const medicineName = row.querySelector('.presc-name')?.value?.trim();
        const dose = row.querySelector('.presc-dose')?.value?.trim();
        const doseQuantity = parseFloat(row.querySelector('.presc-doseQty')?.value) || 1;
        const doseUnit = row.querySelector('.presc-doseUnit')?.value?.trim();
        const frequency = row.querySelector('.presc-freq')?.value?.trim();
        const duration = row.querySelector('.presc-dur')?.value?.trim();
        const supplyId = row.querySelector('.presc-supply')?.value || undefined;
        const soldInClinic = row.querySelector('.presc-soldInClinic')?.checked || false;
        const dispensingQuantity = parseInt(row.querySelector('.presc-dispQty')?.value) || 1;
        if (medicineName) {
          prescriptions.push({ medicineName, dose, doseQuantity, doseUnit, frequency, duration, supplyId, soldInClinic, dispensingQuantity });
        }
      });
      
      // Collect procedures (from price items or custom)
      const procedures = [];
      document.querySelectorAll('.procedure-row').forEach(row => {
        const name = row.querySelector('.proc-name')?.value?.trim();
        const priceItemId = row.querySelector('.proc-priceItem')?.value;
        const customPrice = parseFloat(row.querySelector('.proc-customPrice')?.value) || 0;
        const quantity = parseInt(row.querySelector('.proc-quantity')?.value) || 1;
        const supplyId = row.querySelector('.proc-supply')?.value;
        if (name) {
          procedures.push({ name, priceItemId: priceItemId || undefined, customPrice, quantity, supplyId: supplyId || undefined });
        }
      });
      
      // Collect supply items for billing
      const supplyItems = [];
      document.querySelectorAll('.supply-item-row').forEach(row => {
        const desc = row.querySelector('.si-desc')?.value?.trim();
        const qty = parseInt(row.querySelector('.si-qty')?.value) || 1;
        const price = parseFloat(row.querySelector('.si-price')?.value) || 0;
        const supplyId = row.dataset.supplyId || undefined;
        if (desc) {
          supplyItems.push({ description: desc, quantity: qty, unitPrice: price, totalPrice: qty * price, supplyId });
        }
      });
      
      const paymentMethod = document.getElementById('record-payment-method').value;
      
      const payload = {
        petId,
        date: new Date(date).toISOString(),
        visitReason: reason,
        diagnosis: document.getElementById('record-diagnosis').value.trim(),
        treatment: document.getElementById('record-treatment').value.trim(),
        weight: parseFloat(document.getElementById('record-weight').value) || undefined,
        temperature: parseFloat(document.getElementById('record-temperature').value) || undefined,
        nextVisitDate: document.getElementById('record-nextVisit').value || undefined,
        observations: document.getElementById('record-observations').value.trim(),
      };
      
      if (procedures.length) payload.procedures = procedures;
      if (prescriptions.length) payload.prescriptions = prescriptions;
      
      if (paymentMethod) {
        payload.paymentMethod = paymentMethod;
        payload.paymentStatus = document.getElementById('record-payment-status').value;
        payload.paymentDueDate = document.getElementById('record-payment-dueDate').value || undefined;
        payload.paymentNotes = document.getElementById('record-payment-notes').value.trim() || undefined;
      }

      if (supplyItems.length) {
        payload.supplyItems = supplyItems;
      }
      
      try {
        await api.post('/medical-records', payload);
        showToast('Consulta creada exitosamente', 'success');
        await loadMedicalRecordsData(1, pageData.medicalRecords?.petId || '');
        renderMedicalRecordsPage(document.getElementById('page-content'));
      } catch (e) {
        showToast(e.message || 'Error creando consulta', 'error');
        return false;
      }
    }
  });
  
  // Prescription rows - with optional stock sell
  let prescCount = 0;
  document.getElementById('add-prescription-btn')?.addEventListener('click', () => {
    const container = document.getElementById('prescriptions-container');
    const div = document.createElement('div');
    div.className = 'prescription-row row-item';
    div.innerHTML = `
      <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap">
        <input class="form-input presc-name" placeholder="Nombre del medicamento" style="flex:2;min-width:150px">
        <input class="form-input presc-dose" placeholder="Dosis (ej: 500mg)" style="flex:1;min-width:100px">
        <input class="form-input presc-doseQty" type="number" value="1" min="0.1" step="0.1" style="width:55px" title="Cantidad por toma">
        <input class="form-input presc-doseUnit" placeholder="Unidad" style="width:80px" value="comprimidos">
        <input class="form-input presc-freq" placeholder="Frecuencia (ej: cada 8hs)" style="flex:1;min-width:110px">
        <input class="form-input presc-dur" placeholder="Duración (ej: 7 días)" style="flex:1;min-width:100px">
        <button type="button" class="btn btn-danger btn-sm">X</button>
      </div>
      <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap;margin-top:6px;padding-top:6px;border-top:1px solid var(--border)">
        <select class="form-input presc-supply" style="flex:2;min-width:140px">
          <option value="">Vincular insumo (opcional)</option>
          ${suppliesCache.map(s => `<option value="${s.id}">${s.name}</option>`).join('')}
        </select>
        <label style="display:flex;align-items:center;gap:4px;font-size:var(--text-xs);white-space:nowrap">
          <input type="checkbox" class="presc-soldInClinic" style="width:auto">
          Vender en clínica
        </label>
        <input class="form-input presc-dispQty" type="number" placeholder="Cant." value="1" min="1" style="width:55px" title="Cantidad a dispensar">
      </div>
    `;
    container.appendChild(div);
    div.querySelector('.btn-danger').addEventListener('click', () => div.remove());
    
    const supplySelect = div.querySelector('.presc-supply');
    const soldInClinicCheck = div.querySelector('.presc-soldInClinic');
    supplySelect.addEventListener('change', () => {
      if (supplySelect.value) {
        soldInClinicCheck.checked = true;
      }
    });
  });
  
  // Procedure rows - from price items
  let procCount = 0;
  document.getElementById('add-procedure-btn')?.addEventListener('click', () => {
    const container = document.getElementById('procedures-container');
    const div = document.createElement('div');
    div.className = 'procedure-row row-item';
    div.style.position = 'relative';
    div.innerHTML = `
      <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap">
        <div style="flex:2;min-width:180px;position:relative">
          <input class="form-input proc-name" placeholder="Buscar procedimiento..." autocomplete="off" style="width:100%">
          <div class="autocomplete-dropdown" style="display:none"></div>
        </div>
        <select class="form-input proc-priceItem" style="flex:1;min-width:120px;display:none"></select>
        <input class="form-input proc-customPrice" type="number" placeholder="$ Precio" step="0.01" style="width:90px">
        <input class="form-input proc-quantity" type="number" value="1" min="1" style="width:55px">
        <select class="form-input proc-supply" style="flex:1;min-width:120px"><option value="">Insumo (opcional)</option></select>
        <button type="button" class="btn btn-danger btn-sm">X</button>
      </div>
    `;
    container.appendChild(div);
    
    // Populate supply dropdown
    const supplySel = div.querySelector('.proc-supply');
    suppliesCache.forEach(s => supplySel.innerHTML += `<option value="${s.id}">${s.name}</option>`);
    
    // Autocomplete for procedure name from price items
    const nameInput = div.querySelector('.proc-name');
    const dropdown = div.querySelector('.autocomplete-dropdown');
    const priceInput = div.querySelector('.proc-customPrice');
    const priceItemSel = div.querySelector('.proc-priceItem');
    
    nameInput.addEventListener('input', () => {
      const q = nameInput.value.trim().toLowerCase();
      if (q.length < 1) { dropdown.style.display = 'none'; return; }
      const matches = priceItemsCache.filter(i => i.name.toLowerCase().includes(q)).slice(0, 10);
      if (!matches.length) { dropdown.style.display = 'none'; return; }
      dropdown.innerHTML = matches.map(i => 
        `<div class="ac-option" data-id="${i.id}" data-name="${i.name}" data-price="${i.price || 0}"><span>${i.name}</span><span>${formatCurrency(i.price || 0)}</span></div>`
      ).join('');
      dropdown.style.display = 'block';
      dropdown.querySelectorAll('.ac-option').forEach(opt => {
        opt.addEventListener('click', () => {
          nameInput.value = opt.dataset.name;
          priceInput.value = opt.dataset.price;
          priceItemSel.innerHTML = `<option value="${opt.dataset.id}" selected>${opt.dataset.name}</option>`;
          dropdown.style.display = 'none';
        });
      });
    });
    nameInput.addEventListener('blur', () => setTimeout(() => dropdown.style.display = 'none', 200));
    
    div.querySelector('.btn-danger').addEventListener('click', () => { div.remove(); recalcRecordTotal(); });
    priceInput.addEventListener('input', recalcRecordTotal);
    div.querySelector('.proc-quantity').addEventListener('input', recalcRecordTotal);

    supplySel.addEventListener('change', () => {
      const selectedSupplyId = supplySel.value;
      if (!selectedSupplyId) return;
      const existingRow = document.querySelector(`.supply-item-row[data-supply-id="${selectedSupplyId}"]`);
      if (existingRow) {
        existingRow.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
      }
      const supply = suppliesCache.find(s => s.id === selectedSupplyId);
      if (!supply) return;
      document.getElementById('add-supply-item-btn')?.click();
      const newRow = container.parentElement?.querySelector('.supply-item-row:last-child') || document.querySelector('.supply-item-row:last-child');
      if (newRow) {
        const descInput = newRow.querySelector('.si-desc');
        const priceInput = newRow.querySelector('.si-price');
        const qtyInput = newRow.querySelector('.si-qty');
        if (descInput) descInput.value = supply.name;
        if (priceInput) priceInput.value = supply.salePrice || supply.unitPrice || 0;
        if (qtyInput) qtyInput.value = 1;
        newRow.dataset.supplyId = selectedSupplyId;
        if (priceInput) priceInput.dispatchEvent(new Event('input'));
      }
    });
  });
  
  // Supply items for billing - from supplies
  let supplyItemCount = 0;
  document.getElementById('add-supply-item-btn')?.addEventListener('click', () => {
    const container = document.getElementById('supply-items-container');
    const div = document.createElement('div');
    div.className = 'supply-item-row row-item';
    div.style.position = 'relative';
    div.innerHTML = `
      <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap">
        <div style="flex:3;min-width:180px;position:relative">
          <input class="form-input si-desc" placeholder="Buscar insumo..." autocomplete="off" style="width:100%">
          <div class="autocomplete-dropdown" style="display:none"></div>
        </div>
        <input class="form-input si-qty" type="number" value="1" min="1" style="width:55px">
        <input class="form-input si-price" type="number" placeholder="$ Precio" step="0.01" style="width:90px">
        <span class="si-subtotal" style="width:80px;font-weight:600">$0.00</span>
        <button type="button" class="btn btn-danger btn-sm">X</button>
      </div>
    `;
    container.appendChild(div);
    
    const descInput = div.querySelector('.si-desc');
    const dropdown = div.querySelector('.autocomplete-dropdown');
    const qtyInput = div.querySelector('.si-qty');
    const priceInput = div.querySelector('.si-price');
    
    descInput.addEventListener('input', () => {
      const q = descInput.value.trim().toLowerCase();
      if (q.length < 1) { dropdown.style.display = 'none'; return; }
      const matches = suppliesCache.filter(s => 
        s.name.toLowerCase().includes(q) || (s.brand && s.brand.toLowerCase().includes(q))
      ).slice(0, 10);
      if (!matches.length) { dropdown.style.display = 'none'; return; }
      dropdown.innerHTML = matches.map(s => 
        `<div class="ac-option" data-id="${s.id}" data-name="${s.name}" data-price="${s.salePrice || s.unitPrice || 0}"><span>${s.name}${s.brand ? ' - ' + s.brand : ''}</span><span>${formatCurrency(s.salePrice || s.unitPrice || 0)}</span></div>`
      ).join('');
      dropdown.style.display = 'block';
      dropdown.querySelectorAll('.ac-option').forEach(opt => {
        opt.addEventListener('click', () => {
          descInput.value = opt.dataset.name;
          priceInput.value = opt.dataset.price;
          div.dataset.supplyId = opt.dataset.id;
          dropdown.style.display = 'none';
          priceInput.dispatchEvent(new Event('input'));
          recalcRecordTotal();
        });
      });
    });
    descInput.addEventListener('blur', () => setTimeout(() => dropdown.style.display = 'none', 200));
    
    div.querySelector('.btn-danger').addEventListener('click', () => { div.remove(); recalcRecordTotal(); });
    
    const recalc = () => {
      const qty = parseInt(qtyInput?.value) || 0;
      const price = parseFloat(priceInput?.value) || 0;
      div.querySelector('.si-subtotal').textContent = '$' + (qty * price).toFixed(2);
      recalcRecordTotal();
    };
    qtyInput.addEventListener('input', recalc);
    priceInput.addEventListener('input', recalc);
  });
}

function recalcRecordTotal() {
  let total = 0;
  document.querySelectorAll('.procedure-row').forEach(row => {
    const qty = parseInt(row.querySelector('.proc-quantity')?.value) || 0;
    const price = parseFloat(row.querySelector('.proc-customPrice')?.value) || 0;
    total += qty * price;
  });
  document.querySelectorAll('.supply-item-row').forEach(row => {
    const qty = parseInt(row.querySelector('.si-qty')?.value) || 0;
    const price = parseFloat(row.querySelector('.si-price')?.value) || 0;
    total += qty * price;
  });
  const el = document.getElementById('record-payment-total');
  if (el) el.value = '$' + total.toFixed(2);
}

let paymentItemCounter = 0;

function showAddPaymentModal() {
  let suppliesCache = [];
  let clientsCache = [];
  let petsCache = [];
  
  api.get('/supplies?limit=200').then(r => { suppliesCache = r.data || []; }).catch(() => {});
  api.get('/clients?limit=200').then(r => { 
    clientsCache = r.data || []; 
    setTimeout(() => populateClientSelect(), 300);
  }).catch(() => {});
  
  openModal({
    title: 'Nuevo Cobro',
    size: 'xl',
    content: `
      <style>
        .payment-item-row { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); padding: var(--space-3); margin-bottom: var(--space-2); }
        .supply-dropdown { position: absolute; background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); max-height: 200px; overflow-y: auto; z-index: 100; width: 100%; box-shadow: var(--shadow-md); }
        .supply-option { padding: 8px 12px; cursor: pointer; font-size: var(--text-sm); display: flex; justify-content: space-between; }
        .supply-option:hover { background: var(--bg); }
      </style>
      <div class="form-row">
        <div class="form-group" style="flex:2">
          <label class="form-label required">Cliente</label>
          <div style="display:flex;gap:8px">
            <select class="form-input" id="pay-clientId" style="flex:1">
              <option value="">Seleccionar...</option>
              <option value="__new__">+ Crear cliente ocasional</option>
            </select>
          </div>
          <div id="new-client-quick-form" style="display:none;margin-top:8px;background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);padding:12px">
            <div class="form-row" style="display:flex;gap:8px;flex-wrap:wrap">
              <input class="form-input" id="quick-client-name" placeholder="Nombre *" style="flex:2;min-width:120px">
              <input class="form-input" id="quick-client-dni" placeholder="DNI/CUIL" style="flex:1;min-width:100px">
              <input class="form-input" id="quick-client-phone" placeholder="Teléfono" style="flex:1;min-width:100px">
            </div>
          </div>
        </div>
        <div class="form-group" style="flex:1">
          <label class="form-label">Mascota</label>
          <select class="form-input" id="pay-petId">
            <option value="">Seleccionar...</option>
          </select>
        </div>
      </div>
      <div class="form-row">
        <div class="form-group" style="flex:1">
          <label class="form-label required">Método de cobro</label>
          <select class="form-input" id="pay-method">
            <option value="CASH">Efectivo</option>
            <option value="TRANSFER">Transferencia</option>
            <option value="MP_QR">MercadoPago QR</option>
            <option value="MP_CHECKOUT">MercadoPago Checkout</option>
            <option value="CHECK">Cheque</option>
            <option value="OTHER">Otro</option>
          </select>
        </div>
        <div class="form-group" style="flex:1">
          <label class="form-label required">Estado</label>
          <select class="form-input" id="pay-status">
            <option value="PENDING">Pendiente</option>
            <option value="PAID">Pagado</option>
            <option value="DEFERRED">Diferido</option>
          </select>
        </div>
        <div class="form-group" style="flex:1">
          <label class="form-label">Vencimiento</label>
          <input type="date" class="form-input" id="pay-dueDate">
        </div>
      </div>
      <div class="record-section" style="margin-top:12px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
          <strong>Items del cobro</strong>
          <button type="button" class="btn btn-outline btn-sm" id="add-payment-item-btn">+ Item</button>
        </div>
        <div id="payment-items-container"></div>
      </div>
      <div class="form-row" style="margin-top:12px">
        <div class="form-group" style="flex:1">
          <label class="form-label">Total</label>
          <input type="text" class="form-input" id="pay-total" readonly value="$0.00" style="font-weight:700;font-size:var(--text-lg)">
        </div>
        <div class="form-group" style="flex:1">
          <label class="form-label">Notas</label>
          <input type="text" class="form-input" id="pay-notes">
        </div>
      </div>
    `,
    confirmText: 'Crear Cobro',
    onConfirm: async () => {
      let clientId = document.getElementById('pay-clientId').value;
      
      if (clientId === '__new__') {
        const name = document.getElementById('quick-client-name').value.trim();
        if (!name) {
          showToast('El nombre del cliente es requerido', 'error');
          return false;
        }
        try {
          const newClient = await api.post('/clients', {
            name,
            dni: document.getElementById('quick-client-dni').value.trim(),
            phone: document.getElementById('quick-client-phone').value.trim(),
          });
          clientId = newClient.id;
        } catch (e) {
          showToast(e.message || 'Error creando cliente', 'error');
          return false;
        }
      }
      
      if (!clientId) {
        showToast('Debe seleccionar un cliente', 'error');
        return false;
      }
      
      const items = [];
      document.querySelectorAll('.payment-item-row').forEach(row => {
        const desc = row.querySelector('.pay-item-desc')?.value?.trim();
        const qty = parseInt(row.querySelector('.pay-item-qty')?.value) || 1;
        const price = parseFloat(row.querySelector('.pay-item-price')?.value) || 0;
        if (desc) {
          items.push({ description: desc, quantity: qty, unitPrice: price, totalPrice: qty * price });
        }
      });
      
      const totalAmount = items.reduce((s, i) => s + i.totalPrice, 0);
      const petId = document.getElementById('pay-petId').value;
      const method = document.getElementById('pay-method').value;
      const status = document.getElementById('pay-status').value;
      const dueDate = document.getElementById('pay-dueDate').value;
      const notes = document.getElementById('pay-notes').value.trim();
      
      try {
        await api.post('/payments', {
          clientId,
          petId: petId || undefined,
          method,
          status,
          totalAmount,
          items: items.length ? items : undefined,
          dueDate: dueDate || undefined,
          notes: notes || undefined,
        });
        showToast('Cobro creado exitosamente', 'success');
        await Promise.all([loadPaymentsData(1, ''), loadDebtsData(1, '')]);
        renderPaymentsPage(document.getElementById('page-content'));
      } catch (e) {
        showToast(e.message || 'Error creando cobro', 'error');
        return false;
      }
    }
  });
  
  function populateClientSelect() {
    const sel = document.getElementById('pay-clientId');
    if (!sel) return;
    const options = '<option value="">Seleccionar...</option><option value="__new__">+ Crear cliente ocasional</option>' +
      clientsCache.map(c => `<option value="${c.id}">${c.name} ${c.lastName || ''}</option>`).join('');
    sel.innerHTML = options;
  }
  
  document.getElementById('pay-clientId')?.addEventListener('change', (e) => {
    const val = e.target.value;
    const quickForm = document.getElementById('new-client-quick-form');
    if (quickForm) quickForm.style.display = val === '__new__' ? 'block' : 'none';
    
    const petSel = document.getElementById('pay-petId');
    if (!petSel) return;
    petSel.innerHTML = '<option value="">Seleccionar...</option>';
    if (val && val !== '__new__') {
      api.get(`/clients/${val}/pets`).then(pets => {
        if (pets.length) pets.forEach(p => petSel.innerHTML += `<option value="${p.id}">${p.name}</option>`);
      }).catch(() => {});
    }
  });
  
  setTimeout(() => {
    const addBtn = document.getElementById('add-payment-item-btn');
    const container = document.getElementById('payment-items-container');
    if (addBtn && container) {
      addBtn.addEventListener('click', () => addItemRow(container));
    }
  }, 200);
  
  function addItemRow(container) {
    const div = document.createElement('div');
    div.className = 'payment-item-row';
    div.style.position = 'relative';
    div.innerHTML = `
      <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
        <div style="flex:3;min-width:180px;position:relative">
          <input class="form-input pay-item-desc" placeholder="Buscar insumo o describir..." autocomplete="off" style="width:100%">
          <div class="supply-dropdown" style="display:none"></div>
        </div>
        <input class="form-input pay-item-qty" type="number" value="1" min="1" style="width:55px">
        <input class="form-input pay-item-price" type="number" placeholder="$" step="0.01" style="width:90px">
        <span class="pay-item-subtotal" style="width:80px;font-weight:600">$0.00</span>
        <button type="button" class="btn btn-danger btn-sm remove-pay-item">X</button>
      </div>
    `;
    container.appendChild(div);
    
    const descInput = div.querySelector('.pay-item-desc');
    const dropdown = div.querySelector('.supply-dropdown');
    const qtyInput = div.querySelector('.pay-item-qty');
    const priceInput = div.querySelector('.pay-item-price');
    
    descInput.addEventListener('input', () => {
      const q = descInput.value.trim().toLowerCase();
      if (q.length < 1) { dropdown.style.display = 'none'; return; }
      const matches = suppliesCache.filter(s => 
        s.name.toLowerCase().includes(q) || (s.brand && s.brand.toLowerCase().includes(q))
      ).slice(0, 10);
      if (!matches.length) { dropdown.style.display = 'none'; return; }
      dropdown.innerHTML = matches.map(s => 
        `<div class="supply-option" data-id="${s.id}" data-name="${s.name}" data-price="${s.salePrice || s.unitPrice || 0}">
          <span>${s.name}${s.brand ? ' - ' + s.brand : ''}</span>
          <span>${formatCurrency(s.salePrice || s.unitPrice || 0)}</span>
        </div>`
      ).join('');
      dropdown.style.display = 'block';
      dropdown.querySelectorAll('.supply-option').forEach(opt => {
        opt.addEventListener('click', () => {
          descInput.value = opt.dataset.name;
          priceInput.value = opt.dataset.price;
          dropdown.style.display = 'none';
          recalcPaymentTotal();
        });
      });
    });
    
    descInput.addEventListener('blur', () => { setTimeout(() => dropdown.style.display = 'none', 200); });
    
    div.querySelector('.remove-pay-item').addEventListener('click', () => { div.remove(); recalcPaymentTotal(); });
    
    const recalc = () => {
      const qty = parseInt(qtyInput?.value) || 0;
      const price = parseFloat(priceInput?.value) || 0;
      div.querySelector('.pay-item-subtotal').textContent = '$' + (qty * price).toFixed(2);
      recalcPaymentTotal();
    };
    qtyInput.addEventListener('input', recalc);
    priceInput.addEventListener('input', recalc);
  }
}

function recalcPaymentTotal() {
  let total = 0;
  document.querySelectorAll('.payment-item-row').forEach(row => {
    const qty = parseInt(row.querySelector('.pay-item-qty')?.value) || 0;
    const price = parseFloat(row.querySelector('.pay-item-price')?.value) || 0;
    total += qty * price;
  });
  const el = document.getElementById('pay-total');
  if (el) el.value = '$' + total.toFixed(2);
}

async function showPaymentDetail(paymentId) {
  let payment;
  try {
    payment = await api.get(`/payments/${paymentId}`);
  } catch (e) {
    showToast('Error cargando cobro', 'error');
    return;
  }
  
  let mpConnected = false;
  try {
    const mpStatus = await api.get('/mercadopago/oauth/status');
    mpConnected = mpStatus.connected;
  } catch {}
  
  const isPending = payment.status === 'PENDING';
  const method = payment.method;
  const isElectronic = ['MP_QR', 'MP_CHECKOUT'].includes(method);
  const methodLabels = { CASH: 'Efectivo', TRANSFER: 'Transferencia', MP_QR: 'MercadoPago QR', MP_CHECKOUT: 'MercadoPago Checkout', CHECK: 'Cheque', OTHER: 'Otro' };
  
  let actionsHTML = '';
  if (isPending) {
    if (method === 'CASH') {
      actionsHTML += `<button class="btn btn-primary" id="pay-confirm-cash">Confirmar cobro en efectivo</button>`;
    } else if (method === 'MP_QR' && mpConnected) {
      actionsHTML += `<button class="btn btn-primary" id="pay-generate-qr">Generar QR</button>`;
    } else if (method === 'MP_CHECKOUT' && mpConnected) {
      actionsHTML += `<button class="btn btn-primary" id="pay-checkout-link">Enviar link de pago</button>`;
    } else if (method === 'TRANSFER') {
      actionsHTML += `<button class="btn btn-primary" id="pay-confirm-transfer">Confirmar transferencia recibida</button>`;
    } else if (!isElectronic) {
      actionsHTML += `<button class="btn btn-primary" id="pay-confirm-generic">Confirmar cobro</button>`;
    }
    if (isElectronic && !mpConnected) {
      actionsHTML += `
      <div style="padding:12px;background:var(--color-background-danger);border:1px solid var(--color-border-danger);border-radius:var(--border-radius-md)">
        <p style="font-size:var(--text-sm);color:var(--color-danger);margin:0 0 4px;font-weight:500">MercadoPago no conectado</p>
        <p style="font-size:var(--text-xs);color:var(--color-danger);margin:0">Para cobrar con este método configurá tu cuenta en <strong>Ajustes → MercadoPago</strong>. Mientras tanto, podés cambiar el método de pago.</p>
      </div>`;
    }
  }
  
  const itemsHTML = payment.items?.length ? `
    <h4 style="margin:16px 0 8px;font-size:var(--text-sm)">Items</h4>
    <table class="data-table" style="font-size:var(--text-xs)">
      <thead><tr><th>Descripción</th><th>Cant.</th><th>Precio</th><th>Subtotal</th></tr></thead>
      <tbody>${payment.items.map(i => `<tr><td>${i.description}</td><td>${i.quantity}</td><td>${formatCurrency(i.unitPrice)}</td><td>${formatCurrency(i.totalPrice)}</td></tr>`).join('')}</tbody>
    </table>
  ` : '';
  
  const receiptHTML = payment.status === 'PAID'
    ? `<button class="btn btn-outline btn-sm" id="pay-download-receipt-btn">🧾 Descargar comprobante</button>`
    : '';

  const deleteHTML = `<button class="btn btn-outline btn-sm" id="pay-delete-btn" style="color:var(--color-danger);border-color:var(--color-danger)">Eliminar cobro</button>`;
  
  openModal({
    title: `Cobro ${payment.id.slice(-8).toUpperCase()}`,
    size: 'medium',
    content: `
      <div class="detail-row"><span>Fecha</span><span>${formatDate(payment.createdAt)}</span></div>
      <div class="detail-row"><span>Cliente</span><span>${payment.client?.name || 'Sin cliente'}</span></div>
      <div class="detail-row"><span>Mascota</span><span>${payment.pet?.name || '-'}</span></div>
      <div class="detail-row"><span>Método</span><span>${methodLabels[method] || method || '-'}</span></div>
      <div class="detail-row"><span>Estado</span><span class="badge badge-${payment.status === 'PAID' ? 'success' : 'warning'}">${formatStatus(payment.status, 'payment')}</span></div>
      <div class="detail-row"><span>Total</span><span style="font-size:var(--text-xl);font-weight:700">${formatCurrency(payment.totalAmount)}</span></div>
      ${payment.notes ? `<div class="detail-row"><span>Notas</span><span>${payment.notes}</span></div>` : ''}
      ${itemsHTML}
      ${actionsHTML ? `<div style="margin-top:20px;padding-top:16px;border-top:1px solid var(--border);display:flex;flex-direction:column;gap:8px">${actionsHTML}</div>` : ''}
      <div style="margin-top:16px;padding-top:12px;border-top:1px solid var(--border);display:flex;justify-content:space-between;align-items:center">
  <span>${receiptHTML}</span>
  ${deleteHTML}
</div>
    `,
    showCancel: false,
    showConfirm: true,
    confirmText: 'Cerrar',
  });
  
  // Delay to attach listeners after modal DOM is ready
  setTimeout(() => {
    document.getElementById('pay-confirm-cash')?.addEventListener('click', async () => {
      try {
        await api.patch(`/payments/${paymentId}`, { status: 'PAID', paidAt: new Date().toISOString() });
        showToast(`Cobro confirmado - ingreso en caja: ${formatCurrency(payment.totalAmount)}`, 'success');
        closeModal();
        await loadPaymentsData(pageData.payments?.page || 1, '');
        renderPaymentsPage(document.getElementById('page-content'));
      } catch (e) {
        showToast(e.message || 'Error', 'error');
      }
    });
    
    document.getElementById('pay-confirm-transfer')?.addEventListener('click', async () => {
      try {
        await api.patch(`/payments/${paymentId}`, { status: 'PAID', paidAt: new Date().toISOString() });
        showToast(`Transferencia confirmada - ingreso en caja: ${formatCurrency(payment.totalAmount)}`, 'success');
        closeModal();
        await loadPaymentsData(pageData.payments?.page || 1, '');
        renderPaymentsPage(document.getElementById('page-content'));
      } catch (e) {
        showToast(e.message || 'Error', 'error');
      }
    });
    
    document.getElementById('pay-confirm-generic')?.addEventListener('click', async () => {
      try {
        await api.patch(`/payments/${paymentId}`, { status: 'PAID', paidAt: new Date().toISOString() });
        showToast(`Cobro confirmado - ingreso en caja: ${formatCurrency(payment.totalAmount)}`, 'success');
        closeModal();
        await loadPaymentsData(pageData.payments?.page || 1, '');
        renderPaymentsPage(document.getElementById('page-content'));
      } catch (e) {
        showToast(e.message || 'Error', 'error');
      }
    });
    
    document.getElementById('pay-generate-qr')?.addEventListener('click', () => {
      showQRModal(paymentId);
    });
    
    document.getElementById('pay-checkout-link')?.addEventListener('click', async () => {
      try {
        const result = await api.post(`/payments/${paymentId}/checkout`);
        if (result.initPoint) {
          navigator.clipboard?.writeText(result.initPoint);
          showToast('Link de pago copiado al portapapeles', 'success');
        }
      } catch (e) {
        showToast(e.message || 'Error generando link', 'error');
      }
    });
    
    document.getElementById('pay-delete-btn')?.addEventListener('click', async () => {
      if (!window.confirm('¿Estás seguro de eliminar este cobro? Se aplicará como eliminación lógica.')) return;
      try {
        await api.delete(`/payments/${paymentId}`);
        showToast('Cobro eliminado', 'success');
        closeModal();
        await loadPaymentsData(pageData.payments?.page || 1, '');
        renderPaymentsPage(document.getElementById('page-content'));
      } catch (e) {
        showToast(e.message || 'Error eliminando cobro', 'error');
      }
    });

    document.getElementById('pay-download-receipt-btn')?.addEventListener('click', async (e) => {
      e.stopPropagation();
      try {
        const blob = await api.getBlob(`/payments/${paymentId}/receipt`);
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `comprobante-${paymentId.slice(-6)}.pdf`;
        a.click();
        URL.revokeObjectURL(url);
      } catch (e) {
        showToast('Error al generar el comprobante', 'error');
      }
    });
  }, 100);
}

function showQRModal(paymentId) {
  let countdownInterval = null;
  let timerTimeout = null;
  
  const openQR = async () => {
    let qrData, amount;
    try {
      const result = await api.post('/mercadopago/qr', { paymentId });
      qrData = result.qrData;
      amount = result.amount;
    } catch (e) {
      showToast(e.message || 'Error generando QR. Verifique que MercadoPago esté conectado.', 'error');
      return;
    }
    
    if (countdownInterval) clearInterval(countdownInterval);
    if (timerTimeout) clearTimeout(timerTimeout);
    
    let seconds = 120;
    
    const qrModal = openModal({
      title: 'Cobro por QR - MercadoPago',
      size: 'small',
      content: `
        <div style="text-align:center">
          <div style="margin-bottom:12px;font-size:var(--text-lg);font-weight:700">${formatCurrency(amount || 0)}</div>
          <div id="qr-image-container" style="margin:16px auto;display:inline-block">
            <img src="https://api.qrserver.com/v1/create-qr-code/?size=280x280&data=${encodeURIComponent(qrData)}" style="border:2px solid var(--border);border-radius:var(--radius)">
          </div>
          <div id="qr-countdown" style="margin-top:12px">
            <div style="background:var(--border);border-radius:var(--radius-full);height:6px;width:200px;margin:0 auto 8px">
              <div id="qr-progress" style="background:var(--primary);height:100%;border-radius:var(--radius-full);width:100%;transition:width 1s linear"></div>
            </div>
            <span style="font-size:var(--text-sm);color:var(--text-secondary)">Expira en <strong id="qr-timer">2:00</strong></span>
          </div>
          <p style="font-size:var(--text-xs);color:var(--text-secondary);margin-top:12px">El QR se regenera automáticamente al expirar</p>
        </div>
      `,
      showCancel: false,
      showConfirm: true,
      confirmText: 'Cerrar',
      onConfirm: () => {
        if (countdownInterval) clearInterval(countdownInterval);
        if (timerTimeout) clearTimeout(timerTimeout);
      }
    });
    
    const updateCountdown = () => {
      const mins = Math.floor(seconds / 60);
      const secs = seconds % 60;
      const timerEl = document.getElementById('qr-timer');
      const progressEl = document.getElementById('qr-progress');
      if (timerEl) timerEl.textContent = `${mins}:${secs.toString().padStart(2, '0')}`;
      if (progressEl) progressEl.style.width = `${(seconds / 120) * 100}%`;
      
      if (seconds <= 0) {
        clearInterval(countdownInterval);
        regenQR();
        return;
      }
      seconds--;
    };
    
    countdownInterval = setInterval(updateCountdown, 1000);
    updateCountdown();
    
    function regenQR() {
      const container = document.getElementById('qr-image-container');
      const countdown = document.getElementById('qr-countdown');
      if (container) container.innerHTML = '<div style="padding:40px;color:var(--text-secondary)">Regenerando QR...</div>';
      
      timerTimeout = setTimeout(async () => {
        try {
          const result = await api.post('/mercadopago/qr', { paymentId });
          if (container) {
            container.innerHTML = `<img src="https://api.qrserver.com/v1/create-qr-code/?size=280x280&data=${encodeURIComponent(result.qrData)}" style="border:2px solid var(--border);border-radius:var(--radius)">`;
          }
          seconds = 120;
          if (countdown) countdown.style.display = '';
          countdownInterval = setInterval(updateCountdown, 1000);
          updateCountdown();
        } catch (e) {
          if (container) container.innerHTML = '<div style="padding:40px;color:var(--color-danger)">Error regenerando QR</div>';
        }
      }, 1500);
    }
  };
  
  openQR();
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
    <div class="page-header" style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
      <div class="tabs" style="margin-bottom:0">
        <div class="tab active" data-tab="payments">Cobros</div>
        <div class="tab" data-tab="debts">Deudas</div>
      </div>
      <button class="btn btn-primary" id="new-payment-btn">Nuevo Cobro</button>
    </div>
     <div id="tab-payments" class="tab-content active">
       <div id="payments-list"></div>
       <div id="payments-pagination"></div>
     </div>
     <div id="tab-debts" class="tab-content">
       <div id="debts-list"></div>
       <div id="debts-pagination"></div>
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
  
  document.getElementById('new-payment-btn')?.addEventListener('click', showAddPaymentModal);
  
  const paymentsEl = document.getElementById('payments-list');
  if (payments.length) {
    paymentsEl.innerHTML = `
      <table class="data-table">
        <thead><tr><th>Fecha</th><th>Cliente</th><th>Total</th><th>Estado</th><th>Método</th><th>Acciones</th></tr></thead>
        <tbody>${payments.map(p => `
          <tr>
            <td>${formatDate(p.createdAt)}</td>
            <td>${p.client?.name || '-'}</td>
            <td>${formatCurrency(p.totalAmount)}</td>
            <td><span class="badge badge-${p.status === 'PAID' ? 'success' : p.status === 'PENDING' ? 'warning' : 'danger'}">${formatStatus(p.status, 'payment')}</span></td>
            <td>${p.method || '-'}</td>
            <td><button class="btn btn-outline btn-sm" data-id="${p.id}" data-action="view-payment">Ver</button></td>
          </tr>
        `).join('')}</tbody>
      </table>
    `;
    
    paymentsEl.querySelectorAll('[data-action="view-payment"]').forEach(btn => {
      btn.addEventListener('click', () => showPaymentDetail(btn.dataset.id));
    });
    paymentsEl.querySelectorAll('[data-action="download-receipt"]').forEach(btn => {
      btn.addEventListener('click', async () => {
        try {
          const blob = await api.getBlob(`/payments/${btn.dataset.id}/receipt`);
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `recibo-${btn.dataset.id.slice(-6)}.pdf`;
          a.click();
          URL.revokeObjectURL(url);
        } catch (e) {
          showToast('Error al generar el PDF', 'error');
        }
      });
    });
  } else {
    paymentsEl.innerHTML = '<div class="empty-state"><p>No hay cobros</p></div>';
  }

  const paymentsPaginationEl = document.getElementById('payments-pagination');
  if (pageData.payments?.meta?.totalPages > 1) {
    const pagination = createPagination({
      total: pageData.payments.meta.total,
      page: pageData.payments.page || 1,
      limit: 20,
      onPageChange: async (newPage) => {
        await loadPaymentsData(newPage, pageData.payments?.status || '');
        renderPaymentsPage(document.getElementById('page-content'));
      }
    });
    paymentsPaginationEl.appendChild(pagination);
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
              ${d.status !== 'PAID' ? `<button class="btn btn-outline btn-sm" data-id="${d.id}" data-action="pay-debt">Pagar</button>` : ''}
              ${d.status !== 'PAID' && d.status !== 'CANCELLED' ? `<button class="btn btn-outline btn-sm" data-id="${d.id}" data-action="cancel-debt">Cancelar</button>` : ''}
            </td>
          </tr>
        `).join('')}</tbody>
      </table>
    `;
    
    debtsEl.querySelectorAll('[data-action="pay-debt"]').forEach(btn => {
      btn.addEventListener('click', async () => {
        try {
          await api.patch(`/debts/${btn.dataset.id}/pay`);
          showToast('Deuda marcada como pagada', 'success');
          await loadDebtsData(pageData.debts?.page || 1, '');
          renderPaymentsPage(document.getElementById('page-content'));
        } catch (e) {
          showToast(e.message || 'Error actualizando deuda', 'error');
        }
      });
    });
    
    debtsEl.querySelectorAll('[data-action="cancel-debt"]').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (!window.confirm('¿Cancelar esta deuda?')) return;
        try {
          await api.patch(`/debts/${btn.dataset.id}/cancel`);
          showToast('Deuda cancelada', 'success');
          await loadDebtsData(pageData.debts?.page || 1, '');
          renderPaymentsPage(document.getElementById('page-content'));
        } catch (e) {
          showToast(e.message || 'Error cancelando deuda', 'error');
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
  
  const paginationEl = document.getElementById('supplies-pagination');
  if (paginationEl && data.meta?.totalPages > 1) {
    paginationEl.innerHTML = '';
    const pagination = createPagination({
      total: data.meta.total,
      page: data.page || 1,
      limit: 20,
      onPageChange: async (newPage) => {
        await loadSuppliesData(newPage, pageData.supplies?.search || '');
        renderSuppliesPage(document.getElementById('page-content'));
      }
    });
    paginationEl.appendChild(pagination);
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
      const { message } = await api.post('/ai/chat', {
        message: msg,
        history: chatHistory.slice(0, -1),
        sessionId: 'chat_' + Date.now(),
      });
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
  if (!content) return;
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
      <a class="settings-tab ${tab === 'export' ? 'active' : ''}" href="/settings/export-data">Exportar datos</a>
    </div>
    <div id="settings-content"></div>
  `;
  
  document.querySelectorAll('.settings-tab').forEach(t => {
    t.addEventListener('click', (e) => {
      e.preventDefault();
      router.navigate(t.getAttribute('href'));
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
    case 'export': await renderExportDataContent(contentEl); break;
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
          <input type="text" class="form-input" id="company-legalName" value="${company?.legalName || ''}">
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
        await api.patch('/companies/me', {
          name: document.getElementById('company-name').value,
          legalName: document.getElementById('company-legalName').value,
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
          <div class="plan-price">$27.000 <span>/ mes</span></div>

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
          <div class="plan-price">$240.000 <span>/ año</span></div>
          <div class="plan-saving">Ahorrás $84.000 vs mensual</div>

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
          <button
            class="btn btn-outline btn-sm"
            id="btn-subscribe-test"
            style="margin-top: var(--space-4); opacity: 0.5; font-size: 11px;"
          >
            [TEST] $150 por 2 días
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
  document.getElementById('btn-subscribe-test')?.addEventListener('click', () => handleSubscribe('TEST'));

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
  content.innerHTML = '<div class="loading-spinner">Cargando...</div>';
  
  try {
    const mpStatus = await api.get('/mercadopago/oauth/status').catch(() => ({ connected: false }));
    
    const isConnected = mpStatus.connected;
    
    content.innerHTML = `
      <div class="settings-section">
        <h3>MercadoPago</h3>
        <p style="color: var(--text-secondary); font-size: var(--text-sm); margin-bottom: var(--space-4);">
          Conectá tu cuenta de MercadoPago para recibir pagos por QR y checkout online de tus clientes.
        </p>
        
        <div style="background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-lg); padding: var(--space-6); margin-bottom: var(--space-4); text-align: center;">
          ${isConnected ? `
            <div style="display: flex; flex-direction: column; align-items: center; gap: var(--space-3);">
              <div style="width: 60px; height: 60px; border-radius: 50%; background: rgba(16,185,129,0.1); display: flex; align-items: center; justify-content: center; font-size: 1.5rem;">✓</div>
              <div style="font-weight: 600; color: #065f46;">Cuenta conectada</div>
              ${mpStatus.nickname ? `<div style="font-size: var(--text-sm); color: var(--text-secondary);">@${mpStatus.nickname}</div>` : ''}
              <button class="btn btn-outline btn-sm" id="mp-disconnect-btn" style="margin-top: var(--space-2);">Desconectar</button>
            </div>
          ` : `
            <div style="display: flex; flex-direction: column; align-items: center; gap: var(--space-3);">
              <div style="width: 60px; height: 60px; border-radius: 50%; background: rgba(239,68,68,0.1); display: flex; align-items: center; justify-content: center; font-size: 1.5rem;">⚠</div>
              <div style="font-weight: 600; color: #991b1b;">Cuenta no conectada</div>
              <div style="font-size: var(--text-sm); color: var(--text-secondary);">Necesitás conectar tu cuenta para recibir pagos electrónicos.</div>
              <button class="btn btn-primary" id="mp-connect-btn" style="margin-top: var(--space-2);">
                Conectar con MercadoPago
              </button>
            </div>
          `}
        </div>
        
        ${isConnected ? `
          <div style="border-top: 1px solid var(--border); padding-top: var(--space-4); margin-top: var(--space-4);">
            <h4 style="font-size: var(--text-base); margin-bottom: var(--space-3);">Configuración avanzada</h4>
            <div class="form-group">
              <label class="form-label">Access Token</label>
              <input type="password" class="form-input" id="mp-access-token" value="${mpStatus.accessTokenMasked || ''}" placeholder="Access Token">
            </div>
            <div class="form-group">
              <label class="form-label">Public Key</label>
              <input type="text" class="form-input" id="mp-public-key" value="${mpStatus.publicKey || ''}" placeholder="Public Key">
            </div>
            <button class="btn btn-outline" id="save-mp-btn">Guardar manualmente</button>
          </div>
        ` : ''}
      </div>
    `;
    
    document.getElementById('mp-connect-btn')?.addEventListener('click', async () => {
      try {
        const { url } = await api.get('/mercadopago/oauth/connect');
        window.location.href = url;
      } catch (e) {
        showToast(e.message || 'Error al conectar con MercadoPago', 'error');
      }
    });

    document.getElementById('mp-disconnect-btn')?.addEventListener('click', async () => {
      const confirmed = window.confirm('¿Desconectar tu cuenta de MercadoPago? No podrás recibir pagos electrónicos.');
      if (!confirmed) return;
      try {
        await api.delete('/mercadopago/oauth/disconnect');
        showToast('Cuenta desconectada', 'success');
        renderSettingsMercadoPagoContent(content);
      } catch (e) {
        showToast(e.message || 'Error desconectando', 'error');
      }
    });
    
    document.getElementById('save-mp-btn')?.addEventListener('click', async () => {
      try {
        await api.patch('/companies/me/config', {
          mpAccessToken: document.getElementById('mp-access-token').value,
          mpPublicKey: document.getElementById('mp-public-key').value,
        });
        showToast('Configuración guardada', 'success');
      } catch (e) {
        showToast(e.message || 'Error guardando', 'error');
      }
    });
    
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('connected') === 'true') {
      showToast('MercadoPago conectado exitosamente', 'success');
      history.replaceState(null, '', window.location.pathname);
    } else if (urlParams.get('error') === 'oauth_failed') {
      showToast('Error al conectar con MercadoPago', 'error');
      history.replaceState(null, '', window.location.pathname);
    }
  } catch (e) {
    content.innerHTML = '<div class="empty-state"><p>Error cargando configuración de MercadoPago</p></div>';
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
    <div class="page-header" style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
      <input type="text" class="form-input" id="prices-search" placeholder="Buscar precios..." value="${pageData.priceItems?.search || ''}" style="flex:1;max-width:300px">
      <button class="btn btn-primary" id="add-price-btn">Nuevo Precio</button>
    </div>
    <div id="prices-list"></div>
    <div id="prices-pagination"></div>
  `;
  
  const listEl = document.getElementById('prices-list');
  if (data.data?.length) {
    listEl.innerHTML = `
      <table class="data-table">
        <thead><tr><th>Nombre</th><th>Categoría</th><th>Precio</th><th>Acciones</th></tr></thead>
        <tbody>${data.data.map(p => `
          <tr>
            <td>${p.name}</td>
            <td>${p.category || '-'}</td>
            <td>${formatCurrency(p.price)}</td>
            <td>
              <button class="btn btn-outline btn-sm" data-id="${p.id}" data-action="edit-price">Editar</button>
              <button class="btn btn-danger btn-sm" data-id="${p.id}" data-action="delete-price">Eliminar</button>
            </td>
          </tr>
        `).join('')}</tbody>
      </table>
    `;
    
    listEl.querySelectorAll('[data-action="edit-price"]').forEach(btn => {
      btn.addEventListener('click', () => showPriceModal(btn.dataset.id));
    });
    listEl.querySelectorAll('[data-action="delete-price"]').forEach(btn => {
      btn.addEventListener('click', () => deletePriceItem(btn.dataset.id));
    });
  } else {
    listEl.innerHTML = '<div class="empty-state"><p>No hay precios</p></div>';
  }
  
  if (data.meta?.totalPages > 1) {
    const pagEl = document.getElementById('prices-pagination');
    if (pagEl) {
      const pagination = createPagination({
        total: data.meta.total, page: data.page || 1, limit: 20,
        onPageChange: async (newPage) => {
          await loadPriceItemsData(newPage, pageData.priceItems?.search || '');
          renderSettingsPricesContent(content);
        }
      });
      pagEl.appendChild(pagination);
    }
  }
  
  document.getElementById('add-price-btn')?.addEventListener('click', () => showPriceModal());
  document.getElementById('prices-search')?.addEventListener('input', debounce(async (e) => {
    await loadPriceItemsData(1, e.target.value);
    renderSettingsPricesContent(content);
  }, 400));
}

function showPriceModal(itemId) {
  const isEdit = !!itemId;
  const item = isEdit ? pageData.priceItems?.data?.find(p => p.id === itemId) : null;
  
  openModal({
    title: isEdit ? 'Editar Precio' : 'Nuevo Precio',
    content: `
      <div class="form-group">
        <label class="form-label required">Nombre</label>
        <input type="text" class="form-input" id="price-name" value="${item?.name || ''}">
      </div>
      <div class="form-group">
        <label class="form-label">Categoría</label>
        <input type="text" class="form-input" id="price-category" value="${item?.category || ''}">
      </div>
      <div class="form-group">
        <label class="form-label required">Precio</label>
        <input type="number" class="form-input" id="price-value" step="0.01" value="${item?.price || ''}">
      </div>
      <div class="form-group">
        <label class="form-label">Descripción</label>
        <textarea class="form-input" id="price-desc" rows="2">${item?.description || ''}</textarea>
      </div>
    `,
    confirmText: isEdit ? 'Guardar' : 'Crear',
    onConfirm: async () => {
      const name = document.getElementById('price-name').value.trim();
      const price = parseFloat(document.getElementById('price-value').value);
      
      if (!name || !price || price <= 0) {
        showToast('Nombre y precio son requeridos', 'error');
        return false;
      }
      
      try {
        const payload = {
          name,
          category: document.getElementById('price-category').value.trim(),
          price,
          description: document.getElementById('price-desc').value.trim(),
        };
        
        if (isEdit) {
          await api.patch(`/price-items/${itemId}`, payload);
          showToast('Precio actualizado', 'success');
        } else {
          await api.post('/price-items', payload);
          showToast('Precio creado', 'success');
        }
        
        await loadPriceItemsData(pageData.priceItems?.page || 1, pageData.priceItems?.search || '');
        renderSettingsPricesContent(document.getElementById('settings-content'));
      } catch (e) {
        showToast(e.message || 'Error guardando precio', 'error');
        return false;
      }
    }
  });
}

async function deletePriceItem(itemId) {
  const confirmed = window.confirm('¿Estás seguro de eliminar este precio?');
  if (!confirmed) return;
  
  try {
    await api.delete(`/price-items/${itemId}`);
    showToast('Precio eliminado', 'success');
    await loadPriceItemsData(pageData.priceItems?.page || 1, pageData.priceItems?.search || '');
    renderSettingsPricesContent(document.getElementById('settings-content'));
  } catch (e) {
    showToast(e.message || 'Error eliminando precio', 'error');
  }
}

async function renderSettingsAIContent(content) {
  try {
    const [config, ragStatus] = await Promise.all([
      api.get('/companies/me/config').catch(() => ({})),
      api.get('/ai/rag/status').catch(() => ({ synced: false, documentsCount: 0 }))
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
              <span class="badge ${ragStatus?.documentsCount > 0 ? 'badge-success' : 'badge-warning'}" style="margin-left: var(--space-2);">
                ${ragStatus?.documentsCount || 0} documentos
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
        await api.patch('/companies/me/config', {
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
export async function renderCashRegister() {
  currentPage = 'cash-register';
  if (!document.getElementById('page-content')) {
    try {
      const user = await api.get('/auth/me');
      if (!user || !user.companyId) { router.navigate('/onboarding'); return; }
      renderDashboardLayout(user);
    } catch (e) { router.navigate('/login'); return; }
  }
  await renderCashRegisterPage(document.getElementById('page-content'));
}

async function renderCashRegisterPage(content) {
  if (!content) return;
  
  pageData.cashRegister = pageData.cashRegister || { page: 1, search: '', date: '', startDate: '', endDate: '', type: '' };
  const dc = pageData.cashRegister;
  
  let summaryData = { income: 0, expenses: 0, balance: 0 };
  let movementsData = { data: [], meta: { total: 0, page: 1, limit: 20, totalPages: 0 } };
  
  try {
    const summaryParams = new URLSearchParams();
    if (dc.date) summaryParams.append('date', dc.date);
    else {
      if (dc.startDate) summaryParams.append('startDate', dc.startDate);
      if (dc.endDate) summaryParams.append('endDate', dc.endDate);
    }
    const [summary, movements] = await Promise.all([
      api.get('/cash-register/summary?' + summaryParams.toString()),
      api.get('/cash-register?' + new URLSearchParams({
        page: dc.page || 1,
        limit: 20,
        ...(dc.search && { search: dc.search }),
        ...(dc.type && { type: dc.type }),
        ...(dc.date && { date: dc.date }),
        ...(dc.startDate && { startDate: dc.startDate }),
        ...(dc.endDate && { endDate: dc.endDate }),
      }))
    ]);
    summaryData = summary || summaryData;
    if (movements?.data && movements?.meta) {
      movementsData = movements;
    } else if (Array.isArray(movements)) {
      movementsData = { data: movements, meta: { total: movements.length, page: 1, limit: 20, totalPages: 1 } };
    }
  } catch (e) {
    console.error('[Caja] Error loading data:', e);
  }
  
  content.innerHTML = `
    <style>
      .cash-summary { display: grid; grid-template-columns: repeat(3, 1fr); gap: var(--space-4); margin-bottom: var(--space-4); }
      .cash-card { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-lg); padding: var(--space-4); text-align: center; }
      .cash-card.income { border-color: var(--color-success, #10b981); }
      .cash-card.expense { border-color: var(--color-danger, #ef4444); }
      .cash-label { font-size: var(--text-sm); color: var(--text-secondary); margin-bottom: 4px; }
      .cash-amount { font-size: var(--text-2xl); font-weight: 700; }
      .cash-filters { display: flex; gap: 8px; margin-bottom: var(--space-4); flex-wrap: wrap; align-items: center; }
      .cash-filters .form-input { font-size: var(--text-sm); }
    </style>
    <div class="page-header" style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
      <h2>Caja</h2>
      <div style="display:flex;gap:8px">
        <button class="btn btn-success" id="income-btn">+ Ingreso</button>
        <button class="btn btn-danger" id="expense-btn">- Egreso</button>
      </div>
    </div>
    <div class="cash-summary">
      <div class="cash-card income">
        <div class="cash-label">Ingresos</div>
        <div class="cash-amount" style="color:#10b981">${formatCurrency(summaryData.income || 0)}</div>
      </div>
      <div class="cash-card expense">
        <div class="cash-label">Egresos</div>
        <div class="cash-amount" style="color:#ef4444">${formatCurrency(summaryData.expenses || 0)}</div>
      </div>
      <div class="cash-card">
        <div class="cash-label">Saldo</div>
        <div class="cash-amount">${formatCurrency(summaryData.balance || 0)}</div>
      </div>
    </div>
    <div class="cash-filters">
      <input type="date" class="form-input" id="cash-filter-date" value="${dc.date || ''}" style="width:150px" title="Fecha">
      <input type="date" class="form-input" id="cash-filter-startDate" value="${dc.startDate || ''}" style="width:150px" title="Desde">
      <input type="date" class="form-input" id="cash-filter-endDate" value="${dc.endDate || ''}" style="width:150px" title="Hasta">
      <select class="form-input" id="cash-filter-type" style="width:130px">
        <option value="">Todos</option>
        <option value="INCOME" ${dc.type === 'INCOME' ? 'selected' : ''}>Ingresos</option>
        <option value="EXPENSE" ${dc.type === 'EXPENSE' ? 'selected' : ''}>Egresos</option>
      </select>
      <input type="text" class="form-input" id="cash-filter-search" placeholder="Buscar concepto..." value="${dc.search || ''}" style="flex:1;min-width:150px">
      <button class="btn btn-outline btn-sm" id="cash-search-btn">Buscar</button>
      <button class="btn btn-outline btn-sm" id="cash-clear-btn">Limpiar</button>
    </div>
    <div class="table-container">
      <table class="data-table">
        <thead>
          <tr>
            <th>Fecha</th>
            <th>Tipo</th>
            <th>Monto</th>
            <th>Concepto</th>
            <th>Pago</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody id="cash-table-body">
          ${movementsData.data.length ? '' : '<tr><td colspan="6">No hay movimientos</td></tr>'}
        </tbody>
      </table>
    </div>
    <div id="cash-pagination"></div>
  `;
  
  renderCashTableRows(movementsData.data);
  
  if (movementsData.meta?.totalPages > 1) {
    const pagEl = document.getElementById('cash-pagination');
    const pagination = createPagination({
      total: movementsData.meta.total,
      page: movementsData.meta.page,
      limit: movementsData.meta.limit,
      onPageChange: async (newPage) => {
        dc.page = newPage;
        await renderCashRegisterPage(content);
      }
    });
    if (pagEl) pagEl.appendChild(pagination);
  }
  
  document.getElementById('income-btn')?.addEventListener('click', () => showCashMovementModal('INCOME'));
  document.getElementById('expense-btn')?.addEventListener('click', () => showCashMovementModal('EXPENSE'));
  
  const applyFilters = () => {
    dc.date = document.getElementById('cash-filter-date')?.value || '';
    dc.startDate = document.getElementById('cash-filter-startDate')?.value || '';
    dc.endDate = document.getElementById('cash-filter-endDate')?.value || '';
    dc.type = document.getElementById('cash-filter-type')?.value || '';
    dc.search = document.getElementById('cash-filter-search')?.value?.trim() || '';
    dc.page = 1;
    if (dc.date) { dc.startDate = ''; dc.endDate = ''; }
    renderCashRegisterPage(content);
  };
  
  document.getElementById('cash-search-btn')?.addEventListener('click', applyFilters);
  document.getElementById('cash-filter-search')?.addEventListener('keypress', (e) => { if (e.key === 'Enter') applyFilters(); });
  document.getElementById('cash-filter-type')?.addEventListener('change', applyFilters);
  document.getElementById('cash-filter-date')?.addEventListener('change', applyFilters);
  document.getElementById('cash-filter-startDate')?.addEventListener('change', applyFilters);
  document.getElementById('cash-filter-endDate')?.addEventListener('change', applyFilters);
  document.getElementById('cash-clear-btn')?.addEventListener('click', () => {
    dc.date = ''; dc.startDate = ''; dc.endDate = ''; dc.type = ''; dc.search = ''; dc.page = 1;
    renderCashRegisterPage(content);
  });
}

function renderCashTableRows(movements) {
  const tbody = document.getElementById('cash-table-body');
  if (!tbody) return;
  
  if (!movements?.length) {
    tbody.innerHTML = '<tr><td colspan="6">No hay movimientos</td></tr>';
    return;
  }
  
  tbody.innerHTML = movements.map(m => `
    <tr>
      <td>${formatDateTime(m.date || m.createdAt)}</td>
      <td><span class="badge badge-${m.type === 'INCOME' ? 'success' : 'danger'}">${m.type === 'INCOME' ? 'Ingreso' : 'Egreso'}</span></td>
      <td style="font-weight:600">${formatCurrency(m.amount)}</td>
      <td>${m.reason || '-'}</td>
      <td>${m.payment ? formatCurrency(m.payment.totalAmount) : '-'}</td>
      <td>
        ${!m.paymentId ? `
          <button class="btn btn-outline btn-sm" data-id="${m.id}" data-action="edit-cash">Editar</button>
          <button class="btn btn-danger btn-sm" data-id="${m.id}" data-action="delete-cash">Eliminar</button>
        ` : '<span style="font-size:var(--text-xs);color:var(--text-secondary)">Vinculado</span>'}
      </td>
    </tr>
  `).join('');
  
  tbody.querySelectorAll('[data-action="edit-cash"]').forEach(btn => {
    btn.addEventListener('click', () => showEditCashMovementModal(btn.dataset.id));
  });
  tbody.querySelectorAll('[data-action="delete-cash"]').forEach(btn => {
    btn.addEventListener('click', () => deleteCashMovement(btn.dataset.id));
  });
}

function showCashMovementModal(type) {
  openModal({
    title: type === 'INCOME' ? 'Registrar Ingreso' : 'Registrar Egreso',
    content: `
      <div class="form-group">
        <label class="form-label required">Tipo</label>
        <select class="form-input" id="cash-type">
          <option value="INCOME" ${type === 'INCOME' ? 'selected' : ''}>Ingreso</option>
          <option value="EXPENSE" ${type === 'EXPENSE' ? 'selected' : ''}>Egreso</option>
        </select>
      </div>
      <div class="form-group">
        <label class="form-label required">Monto</label>
        <input type="number" class="form-input" id="cash-amount" step="0.01" min="0.01">
      </div>
      <div class="form-group">
        <label class="form-label required">Concepto</label>
        <input type="text" class="form-input" id="cash-reason">
      </div>
    `,
    confirmText: 'Guardar',
    onConfirm: async () => {
      const amount = parseFloat(document.getElementById('cash-amount').value);
      const reason = document.getElementById('cash-reason').value.trim();
      const cashType = document.getElementById('cash-type').value;
      
      if (!amount || amount <= 0 || !reason) {
        showToast('Debe ingresar monto y concepto', 'error');
        return false;
      }
      
      try {
        await api.post('/cash-register', { type: cashType, amount, reason });
        showToast('Movimiento registrado', 'success');
        await renderCashRegisterPage(document.getElementById('page-content'));
      } catch (e) {
        showToast(e.message || 'Error registrando movimiento', 'error');
        return false;
      }
    }
  });
}

function showEditCashMovementModal(movementId) {
  openModal({
    title: 'Editar Movimiento',
    content: `
      <div class="form-group">
        <label class="form-label required">Monto</label>
        <input type="number" class="form-input" id="cash-edit-amount" step="0.01" min="0.01">
      </div>
      <div class="form-group">
        <label class="form-label required">Concepto</label>
        <input type="text" class="form-input" id="cash-edit-reason">
      </div>
    `,
    confirmText: 'Guardar',
    onConfirm: async () => {
      const amount = parseFloat(document.getElementById('cash-edit-amount').value);
      const reason = document.getElementById('cash-edit-reason').value.trim();
      
      if (!amount || amount <= 0 || !reason) {
        showToast('Debe ingresar monto y concepto', 'error');
        return false;
      }
      
      try {
        await api.patch(`/cash-register/${movementId}`, { amount, reason });
        showToast('Movimiento actualizado', 'success');
        await renderCashRegisterPage(document.getElementById('page-content'));
      } catch (e) {
        showToast(e.message || 'Error actualizando movimiento', 'error');
        return false;
      }
    }
  });
}

async function deleteCashMovement(movementId) {
  const confirmed = window.confirm('¿Estás seguro de eliminar este movimiento?');
  if (!confirmed) return;
  
  try {
    await api.delete(`/cash-register/${movementId}`);
    showToast('Movimiento eliminado', 'success');
    await renderCashRegisterPage(document.getElementById('page-content'));
  } catch (e) {
    showToast(e.message || 'Error eliminando movimiento', 'error');
  }
}

export async function renderSuperAdminSubscriptions() {
  currentPage = 'superadmin';
  if (!document.getElementById('page-content')) {
    try {
      const user = await api.get('/auth/me');
      if (!user || !user.companyId) { router.navigate('/onboarding'); return; }
      renderDashboardLayout(user);
    } catch (e) { router.navigate('/login'); return; }
  }
  const content = document.getElementById('page-content');
  if (!content) return;
  try {
    const subs = await api.get('/superadmin/subscriptions');
    content.innerHTML = `
      <div class="page-header"><h2>Administracion de Suscripciones</h2></div>
      <table class="data-table">
        <thead><tr><th>Empresa</th><th>Estado</th><th>Plan</th><th>Vence</th></tr></thead>
        <tbody>${(subs || []).map(s => '<tr><td>' + (s.company?.name || s.companyId) + '</td><td>' + s.status + '</td><td>' + (s.plan || '-') + '</td><td>' + (s.trialEndsAt ? new Date(s.trialEndsAt).toLocaleDateString() : '-') + '</td></tr>').join('')}</tbody>
      </table>`;
  } catch (e) {
    content.innerHTML = '<div class="empty-state"><p>Error cargando datos: ' + e.message + '</p></div>';
  }
}
