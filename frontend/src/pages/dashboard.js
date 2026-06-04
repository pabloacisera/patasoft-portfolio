import { api } from '../services/api.js';
import { router } from '../router.js';
import { isAuthenticated, getToken } from '../stores/auth.store.js';

import { renderDashboardLayout } from './sections/layout.js';
import { loadHomeData, renderHomePage } from './sections/home.js';
import { loadClientsData, renderClientsPage, showClientModal, showEditClientModal, deleteClient } from './sections/clients.js';
import { loadPetsData, renderPetsPage, showPetModal, showAddPetModal, deletePet } from './sections/pets.js';
import { loadMedicalRecordsData, renderMedicalRecordsPage, showEditRecordModal, deleteRecord, showAddRecordModal, recalcRecordTotal } from './sections/medical-records.js';
import { loadPaymentsData, loadDebtsData, renderPaymentsPage, showAddPaymentModal, recalcPaymentTotal, showPaymentDetail, showQRModal } from './sections/payments.js';
import { loadSuppliesData, renderSuppliesPage, showAddSupplyModal } from './sections/supplies.js';
import { renderChatPage } from './sections/ai-chat.js';
import { loadConnectionsData, renderConnectionsPage } from './sections/connections.js';
import { renderCashRegisterPage } from './sections/cash-register.js';
import { renderSettingsPage, loadPriceItemsData, renderSettingsPricesContent, showPriceModal, deletePriceItem } from './sections/settings.js';
import { renderSuperAdminSubscriptions } from './sections/super-admin.js';

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
    renderDashboardLayout(user, currentPage, loadPage);
  } catch (e) {
    console.error('[Dashboard] Error fetching /auth/me:', e);
    if (e.message !== 'ONBOARDING_REQUIRED') {
      router.navigate('/login');
    }
  }
}

export async function renderDashboardHome() {
  currentPage = 'home';
  
  if (!document.getElementById('page-content')) {
    await renderDashboard();
    return;
  }
  
  await loadHomeData(pageData);
  return renderDashboardPage('home');
}

export async function renderClients() {
  currentPage = 'clients';
  pageData.clients = pageData.clients || { page: 1, search: '' };
  
  if (!document.getElementById('page-content')) {
    await renderDashboard();
    return;
  }
  
  await loadClientsData(pageData, pageData.clients.page, pageData.clients.search);
  return renderDashboardPage('clients');
}

export async function renderPets() {
  currentPage = 'pets';
  pageData.pets = pageData.pets || { page: 1, search: '' };
  
  if (!document.getElementById('page-content')) {
    await renderDashboard();
    return;
  }
  
  await loadPetsData(pageData, pageData.pets.page, pageData.pets.search);
  return renderDashboardPage('pets');
}

export async function renderMedicalRecords() {
  currentPage = 'medical-records';
  pageData.medicalRecords = pageData.medicalRecords || { page: 1, petId: '' };
  
  if (!document.getElementById('page-content')) {
    await renderDashboard();
    return;
  }
  
  await loadMedicalRecordsData(pageData, pageData.medicalRecords.page, pageData.medicalRecords.petId);
  return renderDashboardPage('medical-records');
}

export async function renderPayments() {
  currentPage = 'payments';
  pageData.payments = pageData.payments || { page: 1, status: '' };
  pageData.debts = pageData.debts || { page: 1, status: '' };
  
  if (!document.getElementById('page-content')) {
    await renderDashboard();
    return;
  }
  
  await Promise.all([
    loadPaymentsData(pageData, pageData.payments.page, pageData.payments.status),
    loadDebtsData(pageData, pageData.debts.page, pageData.debts.status)
  ]);
  return renderDashboardPage('payments');
}

export async function renderSupplies() {
  currentPage = 'supplies';
  pageData.supplies = pageData.supplies || { page: 1, search: '' };
  
  if (!document.getElementById('page-content')) {
    await renderDashboard();
    return;
  }
  
  await loadSuppliesData(pageData, pageData.supplies.page, pageData.supplies.search);
  return renderDashboardPage('supplies');
}

export async function renderAIChat() {
  currentPage = 'chat';
  
  if (!document.getElementById('page-content')) {
    await renderDashboard();
    return;
  }
  
  return renderDashboardPage('chat');
}

export async function renderConnections() {
  currentPage = 'connections';
  pageData.connections = pageData.connections || { page: 1, status: '' };
  
  if (!document.getElementById('page-content')) {
    await renderDashboard();
    return;
  }
  
  await loadConnectionsData(pageData, pageData.connections.page, pageData.connections.status);
  return renderDashboardPage('connections');
}

export async function renderDocuments() {
  currentPage = 'documents';
  
  if (!document.getElementById('page-content')) {
    try {
      const user = await api.get('/auth/me');
      if (!user || !user.companyId) {
        router.navigate('/onboarding');
        return;
      }
      renderDashboardLayout(user, currentPage, loadPage);
    } catch (e) {
      console.error('[Dashboard] Error en renderDocuments:', e);
      router.navigate('/login');
      return;
    }
  }
  
  const content = document.getElementById('page-content');
  if (content) {
    content.innerHTML = '<div class="empty-state"><p>Sección de documentos en desarrollo</p></div>';
  }
}

export async function renderSettings() {
  currentPage = 'settings';
  pageData.priceItems = pageData.priceItems || { page: 1, search: '' };
  pageData.settingsConnections = pageData.settingsConnections || { page: 1, status: '' };
  
  if (!document.getElementById('page-content')) {
    try {
      const user = await api.get('/auth/me');
      if (!user || !user.companyId) {
        router.navigate('/onboarding');
        return;
      }
      renderDashboardLayout(user, currentPage, loadPage);
    } catch (e) {
      console.error('[Dashboard] Error en renderSettings:', e);
      router.navigate('/login');
      return;
    }
  }
  
  return renderSettingsPage('company', pageData);
}

export async function renderSettingsCompany() {
  currentPage = 'settings-company';
  
  if (!document.getElementById('page-content')) {
    try {
      const user = await api.get('/auth/me');
      if (!user || !user.companyId) {
        router.navigate('/onboarding');
        return;
      }
      renderDashboardLayout(user, currentPage, loadPage);
    } catch (e) {
      console.error('[Dashboard] Error en renderSettingsCompany:', e);
      router.navigate('/login');
      return;
    }
  }
  
  return renderSettingsPage('company', pageData);
}

export async function renderSettingsSubscription() {
  currentPage = 'settings-subscription';
  
  if (!document.getElementById('page-content')) {
    try {
      const user = await api.get('/auth/me');
      if (!user || !user.companyId) {
        router.navigate('/onboarding');
        return;
      }
      renderDashboardLayout(user, currentPage, loadPage);
    } catch (e) {
      console.error('[Dashboard] Error en renderSettingsSubscription:', e);
      router.navigate('/login');
      return;
    }
  }
  
  return renderSettingsPage('subscription', pageData);
}

export async function renderSettingsMercadoPago() {
  currentPage = 'settings-mercadopago';
  
  if (!document.getElementById('page-content')) {
    try {
      const user = await api.get('/auth/me');
      if (!user || !user.companyId) {
        router.navigate('/onboarding');
        return;
      }
      renderDashboardLayout(user, currentPage, loadPage);
    } catch (e) {
      console.error('[Dashboard] Error en renderSettingsMercadoPago:', e);
      router.navigate('/login');
      return;
    }
  }
  
  return renderSettingsPage('mercadopago', pageData);
}

export async function renderSettingsPrices() {
  currentPage = 'settings-prices';
  pageData.priceItems = pageData.priceItems || { page: 1, search: '' };
  
  if (!document.getElementById('page-content')) {
    try {
      const user = await api.get('/auth/me');
      if (!user || !user.companyId) {
        router.navigate('/onboarding');
        return;
      }
      renderDashboardLayout(user, currentPage, loadPage);
    } catch (e) {
      console.error('[Dashboard] Error en renderSettingsPrices:', e);
      router.navigate('/login');
      return;
    }
  }
  
  await loadPriceItemsData(pageData, pageData.priceItems.page, pageData.priceItems.search);
  return renderSettingsPage('prices', pageData);
}

export async function renderSettingsAI() {
  currentPage = 'settings-ai';
  
  if (!document.getElementById('page-content')) {
    try {
      const user = await api.get('/auth/me');
      if (!user || !user.companyId) {
        router.navigate('/onboarding');
        return;
      }
      renderDashboardLayout(user, currentPage, loadPage);
    } catch (e) {
      console.error('[Dashboard] Error en renderSettingsAI:', e);
      router.navigate('/login');
      return;
    }
  }
  
  return renderSettingsPage('ai', pageData);
}

export async function renderSettingsConnections() {
  currentPage = 'settings-connections';
  pageData.settingsConnections = pageData.settingsConnections || { page: 1, status: '' };
  
  if (!document.getElementById('page-content')) {
    try {
      const user = await api.get('/auth/me');
      if (!user || !user.companyId) {
        router.navigate('/onboarding');
        return;
      }
      renderDashboardLayout(user, currentPage, loadPage);
    } catch (e) {
      console.error('[Dashboard] Error en renderSettingsConnections:', e);
      router.navigate('/login');
      return;
    }
  }
  
  await loadConnectionsData(pageData, pageData.settingsConnections.page, pageData.settingsConnections.status);
  return renderSettingsPage('connections', pageData);
}

export async function renderExportData() {
  currentPage = 'settings-export';
  
  if (!document.getElementById('page-content')) {
    try {
      const user = await api.get('/auth/me');
      if (!user || !user.companyId) {
        router.navigate('/onboarding');
        return;
      }
      renderDashboardLayout(user, currentPage, loadPage);
    } catch (e) {
      console.error('[Dashboard] Error en renderExportData:', e);
      router.navigate('/login');
      return;
    }
  }
  
  return renderSettingsPage('export', pageData);
}

export async function renderCashRegister() {
  currentPage = 'cash-register';
  if (!document.getElementById('page-content')) {
    try {
      const user = await api.get('/auth/me');
      if (!user || !user.companyId) { router.navigate('/onboarding'); return; }
      renderDashboardLayout(user, currentPage, loadPage);
    } catch (e) { router.navigate('/login'); return; }
  }
  await renderCashRegisterPage(document.getElementById('page-content'), pageData);
}

async function renderDashboardPage(page) {
  const content = document.getElementById('page-content');
  if (!content) return;
  
  switch (page) {
    case 'home': await renderHomePage(content, pageData); break;
    case 'clients': await renderClientsPage(content, pageData); break;
    case 'pets': await renderPetsPage(content, pageData); break;
    case 'medical-records': await renderMedicalRecordsPage(content, pageData); break;
    case 'payments': await renderPaymentsPage(content, pageData); break;
    case 'supplies': await renderSuppliesPage(content, pageData); break;
    case 'chat': await renderChatPage(content, pageData); break;
    case 'connections': await renderConnectionsPage(content, pageData); break;
  }
}

async function loadPage(page) {
  switch (page) {
    case 'home':
      await loadHomeData(pageData);
      break;
    case 'clients':
      await loadClientsData(pageData, 1, '');
      break;
    case 'pets':
      await loadPetsData(pageData, 1, '');
      break;
    case 'medical-records':
      await loadMedicalRecordsData(pageData, 1, '');
      break;
    case 'payments':
      await Promise.all([loadPaymentsData(pageData, 1, ''), loadDebtsData(pageData, 1, '')]);
      break;
    case 'supplies':
      await loadSuppliesData(pageData, 1, '');
      break;
    case 'connections':
      await loadConnectionsData(pageData, 1, '');
      break;
  }
  
  await renderDashboardPage(page);
}
