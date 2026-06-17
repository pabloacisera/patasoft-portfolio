import { api } from '../services/api.js';
import { router } from '../router.js';

let currentPage = 'home';
let pageData = {};
const sectionCache = {};

async function loadSection(name) {
  if (sectionCache[name]) return sectionCache[name];
  switch (name) {
    case 'layout': sectionCache[name] = await import('./sections/layout.js'); break;
    case 'home': sectionCache[name] = await import('./sections/home.js'); break;
    case 'clients': sectionCache[name] = await import('./sections/clients.js'); break;
    case 'pets': sectionCache[name] = await import('./sections/pets.js'); break;
    case 'medical-records': sectionCache[name] = await import('./sections/medical-records.js'); break;
    case 'payments': sectionCache[name] = await import('./sections/payments.js'); break;
    case 'supplies': sectionCache[name] = await import('./sections/supplies.js'); break;
    case 'chat': sectionCache[name] = await import('./sections/ai-chat.js'); break;
    case 'connections': sectionCache[name] = await import('./sections/connections.js'); break;
    case 'cash-register': sectionCache[name] = await import('./sections/cash-register.js'); break;
    case 'settings': sectionCache[name] = await import('./sections/settings.js'); break;
    case 'super-admin': sectionCache[name] = await import('./sections/super-admin.js'); break;
  }
  return sectionCache[name];
}

function showImageView(imageUrl) {
  const overlay = document.createElement('div');
  overlay.className = 'image-viewer-overlay';
  overlay.replaceChildren();
  overlay.insertAdjacentHTML('beforeend', `<img src="${imageUrl}">`);
  overlay.addEventListener('click', () => overlay.remove());
  document.body.appendChild(overlay);
}
window.showImageView = showImageView;

export async function renderDashboard() {
  const app = document.getElementById('app');
  
  try {
    const user = await api.get('/auth/me');
    if (!user) {
      router.navigate('/login');
      return;
    }
    if (!user.companyId) {
      router.navigate('/onboarding');
      return;
    }
    user.company = user.company;
    const layout = await loadSection('layout');
    layout.renderDashboardLayout(user, currentPage, loadPage);
  } catch (e) {
    if (e.message !== 'ONBOARDING_REQUIRED') {
      router.navigate('/login');
    }
  }
}

function withDashboard(page, pageKey, loadFn, renderFn) {
  return async () => {
    currentPage = page;
    if (pageKey) {
      pageData[pageKey] = pageData[pageKey] || {};
    }
    if (!document.getElementById('page-content')) {
      await renderDashboard();
    }
    if (loadFn) await loadFn(pageData);
    return renderFn ? renderFn(pageData) : renderDashboardPage(page);
  };
}

function withSettings(page, loadFn) {
  return async () => {
    if (!document.getElementById('page-content')) {
      try {
        const user = await api.get('/auth/me');
        if (!user || !user.companyId) { router.navigate('/onboarding'); return; }
        const layout = await loadSection('layout');
        layout.renderDashboardLayout(user, currentPage, loadPage);
      } catch (e) { router.navigate('/login'); return; }
    }
    if (loadFn) await loadFn(pageData);
    const settings = await loadSection('settings');
    return settings.renderSettingsPage(page, pageData);
  };
}

export const renderDashboardHome = withDashboard('home', null, async (d) => {
  const section = await loadSection('home');
  await section.loadHomeData(d);
});
export const renderClients = withDashboard('clients', 'clients', async (d) => {
  const section = await loadSection('clients');
  await section.loadClientsData(d, d.clients.page, d.clients.search);
});
export const renderPets = withDashboard('pets', 'pets', async (d) => {
  const section = await loadSection('pets');
  await section.loadPetsData(d, d.pets.page, d.pets.search);
});
export const renderMedicalRecords = withDashboard('medical-records', 'medicalRecords', async (d) => {
  const section = await loadSection('medical-records');
  await section.loadMedicalRecordsData(d, d.medicalRecords.page, d.medicalRecords.petId);
});
export const renderPayments = withDashboard('payments', null, async (d) => {
  const section = await loadSection('payments');
  d.payments = d.payments || { page: 1, status: '' };
  d.debts = d.debts || { page: 1, status: '' };
  await Promise.all([
    section.loadPaymentsData(d, d.payments.page, d.payments.status),
    section.loadDebtsData(d, d.debts.page, d.debts.status)
  ]);
});
export const renderSupplies = withDashboard('supplies', 'supplies', async (d) => {
  const section = await loadSection('supplies');
  await section.loadSuppliesData(d, d.supplies.page, d.supplies.search);
});
export const renderAIChat = withDashboard('chat');
export const renderConnections = withDashboard('connections', 'connections', async (d) => {
  const section = await loadSection('connections');
  await section.loadConnectionsData(d, d.connections.page, d.connections.status);
});

export async function renderDocuments() {
  currentPage = 'documents';
  if (!document.getElementById('page-content')) {
    try {
      const user = await api.get('/auth/me');
      if (!user || !user.companyId) { router.navigate('/onboarding'); return; }
      const layout = await loadSection('layout');
      layout.renderDashboardLayout(user, currentPage, loadPage);
    } catch (e) { router.navigate('/login'); return; }
  }
  const content = document.getElementById('page-content');
  if (content) {
    content.replaceChildren();
    content.insertAdjacentHTML('beforeend', '<div class="empty-state" role="status"><p>Sección de documentos en desarrollo</p></div>');
  }
}

export const renderSettings = withSettings('company');
export const renderSettingsCompany = withSettings('company');
export const renderSettingsSubscription = withSettings('subscription');
export const renderSettingsMercadoPago = withSettings('mercadopago');
export const renderSettingsAI = withSettings('ai');
export const renderSettingsConnections = withSettings('connections', async (d) => {
  const section = await loadSection('connections');
  d.settingsConnections = d.settingsConnections || { page: 1, status: '' };
  await section.loadConnectionsData(d, d.settingsConnections.page, d.settingsConnections.status);
});
export const renderExportData = withSettings('export');
export const renderSettingsPrices = withSettings('prices', async (d) => {
  const settings = await loadSection('settings');
  d.priceItems = d.priceItems || { page: 1, search: '' };
  await settings.loadPriceItemsData(d, d.priceItems.page, d.priceItems.search);
});

export async function renderSuperAdminSubscriptions() {
  const section = await loadSection('super-admin');
  section.renderSuperAdminSubscriptions(document.getElementById('app'));
}

export async function renderCashRegister() {
  currentPage = 'cash-register';
  if (!document.getElementById('page-content')) {
    try {
      const user = await api.get('/auth/me');
      if (!user || !user.companyId) { router.navigate('/onboarding'); return; }
      const layout = await loadSection('layout');
      layout.renderDashboardLayout(user, currentPage, loadPage);
    } catch (e) { router.navigate('/login'); return; }
  }
  const section = await loadSection('cash-register');
  await section.renderCashRegisterPage(document.getElementById('page-content'), pageData);
}

async function renderDashboardPage(page) {
  const content = document.getElementById('page-content');
  if (!content) return;
  const section = await loadSection(page);
  const renderMap = {
    'home': section.renderHomePage,
    'clients': section.renderClientsPage,
    'pets': section.renderPetsPage,
    'medical-records': section.renderMedicalRecordsPage,
    'payments': section.renderPaymentsPage,
    'supplies': section.renderSuppliesPage,
    'chat': section.renderChatPage,
    'connections': section.renderConnectionsPage,
  };
  const fn = renderMap[page];
  if (fn) await fn(content, pageData);
}

async function loadPage(page) {
  const section = await loadSection(page);
  const loadMap = {
    'home': () => section.loadHomeData(pageData),
    'clients': () => section.loadClientsData(pageData, 1, ''),
    'pets': () => section.loadPetsData(pageData, 1, ''),
    'medical-records': () => section.loadMedicalRecordsData(pageData, 1, ''),
    'payments': () => Promise.all([section.loadPaymentsData(pageData, 1, ''), section.loadDebtsData(pageData, 1, '')]),
    'supplies': () => section.loadSuppliesData(pageData, 1, ''),
    'connections': () => section.loadConnectionsData(pageData, 1, ''),
  };
  const fn = loadMap[page];
  if (fn) await fn();
  await renderDashboardPage(page);
}
