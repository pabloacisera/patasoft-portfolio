import { api } from '../services/api.js';
import { router } from '../router.js';
import { hasRole } from '../stores/auth.store.js';
import { formatDate, formatStatus, formatCurrency } from '../utils/formatters.js';
import { createSearchBar } from '../components/SearchBar.js';
import { createPagination } from '../components/Pagination.js';
import { openModal } from '../components/Modal.js';
import { showToast } from '../components/Toast.js';

let pageData = {};

export async function renderAdmin() {
  if (!hasRole('SUPER_ADMIN')) {
    router.navigate('/dashboard');
    return;
  }

  pageData.companies = pageData.companies || { page: 1, search: '', status: '' };
  pageData.subscriptions = pageData.subscriptions || { page: 1 };
  
  await Promise.all([
    loadCompaniesData(pageData.companies.page, pageData.companies.search, pageData.companies.status),
    loadSubscriptionsData(pageData.subscriptions.page),
  ]);

  return renderAdminPage();
}

async function loadCompaniesData(page = 1, search = '', status = '') {
  try {
    const params = { page, limit: 20 };
    if (search) params.search = search;
    if (status) params.status = status;
    
    const result = await api.get('/admin/companies', params);
    pageData.companies = { ...result, page, search, status };
  } catch (e) {
    pageData.companies = { data: [], meta: { total: 0 }, page, search, status };
  }
}

async function loadSubscriptionsData(page = 1) {
  try {
    const result = await api.get('/admin/subscriptions', { page, limit: 20 });
    pageData.subscriptions = { ...result, page };
  } catch (e) {
    pageData.subscriptions = { data: [], meta: { total: 0 }, page };
  }
}

async function renderAdminPage() {
  const app = document.getElementById('app');
  
  app.replaceChildren();
  app.insertAdjacentHTML('beforeend', `
    <div class="dashboard-layout">
      <aside class="sidebar">
        <div class="sidebar-logo">PataSoft</div>
        <nav class="sidebar-nav">
          <a class="nav-item active" data-page="admin" href="/admin">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
            Admin
          </a>
          <a class="nav-item" href="/dashboard">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
            Volver al Dashboard
          </a>
        </nav>
      </aside>
      <div class="main-content">
        <header class="topbar">
          <div class="page-title" id="page-title">Administración</div>
        </header>
        <main class="page-content" id="page-content"></main>
      </div>
    </div>
  `);

  await renderAdminContent();
}

async function renderAdminContent() {
  const content = document.getElementById('page-content');
  const companies = pageData.companies?.data || [];
  const subscriptions = pageData.subscriptions?.data || [];

  content.replaceChildren();
  content.insertAdjacentHTML('beforeend', `
    <div class="admin-tabs">
      <div class="admin-tab active" data-tab="companies">Empresas</div>
      <div class="admin-tab" data-tab="subscriptions">Suscripciones</div>
    </div>

    <div id="tab-companies" class="admin-section active">
      <div class="page-header">
        <div id="search-companies"></div>
        <select id="filter-status" class="form-input" style="width: auto;">
          <option value="">Todos</option>
          <option value="active">Activas</option>
          <option value="blocked">Bloqueadas</option>
        </select>
      </div>
      <div id="companies-list"></div>
    </div>

    <div id="tab-subscriptions" class="admin-section">
      <div id="subscriptions-list"></div>
    </div>
  `);

  document.querySelectorAll('.admin-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.admin-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      document.querySelectorAll('.admin-section').forEach(s => s.classList.remove('active'));
      document.getElementById(`tab-${tab.dataset.tab}`).classList.add('active');
    });
  });

  const searchBar = createSearchBar({
    placeholder: 'Buscar empresas...',
    initialValue: pageData.companies.search || '',
    onSearch: async (query) => {
      pageData.companies.search = query;
      await loadCompaniesData(1, query, pageData.companies.status);
      renderCompaniesList();
    }
  });
  document.getElementById('search-companies').appendChild(searchBar);

  document.getElementById('filter-status')?.addEventListener('change', async (e) => {
    pageData.companies.status = e.target.value;
    await loadCompaniesData(1, pageData.companies.search, e.target.value);
    renderCompaniesList();
  });

  renderCompaniesList();
  renderSubscriptionsList();
}

function renderCompaniesList() {
  const data = pageData.companies || { data: [], meta: { total: 0 } };
  const listEl = document.getElementById('companies-list');
  
  if (!listEl) return;

  if (data.data?.length) {
    listEl.replaceChildren();
    listEl.insertAdjacentHTML('beforeend', `
      <table class="data-table">
        <thead><tr><th>Nombre</th><th>Email</th><th>Estado</th><th>Suscripción</th><th>Fecha creación</th><th>Acciones</th></tr></thead>
        <tbody>${data.data.map(c => `
          <tr>
            <td>${c.name}</td>
            <td>${c.email || '-'}</td>
            <td><span class="badge badge-${c.isBlocked ? 'danger' : 'success'}">${c.isBlocked ? 'Bloqueada' : 'Activa'}</span></td>
            <td>${c.subscription?.status || '-'}</td>
            <td>${formatDate(c.createdAt)}</td>
            <td>
              ${c.isBlocked 
                ? `<button class="btn btn-outline btn-sm" data-id="${c.id}" data-action="unblock">Desbloquear</button>`
                : `<button class="btn btn-outline btn-sm" data-id="${c.id}" data-action="block">Bloquear</button>`
              }
            </td>
          </tr>
        `).join('')}</tbody>
      </table>
    `);

    listEl.querySelectorAll('[data-action="block"]').forEach(btn => {
      btn.addEventListener('click', () => showBlockModal(btn.dataset.id, true));
    });

    listEl.querySelectorAll('[data-action="unblock"]').forEach(btn => {
      btn.addEventListener('click', () => showBlockModal(btn.dataset.id, false));
    });
  } else {
    listEl.replaceChildren();
    listEl.insertAdjacentHTML('beforeend', '<div class="empty-state" role="status"><p>No hay empresas</p></div>');
  }
}

function renderSubscriptionsList() {
  const data = pageData.subscriptions || { data: [], meta: { total: 0 } };
  const listEl = document.getElementById('subscriptions-list');
  
  if (!listEl) return;

  if (data.data?.length) {
    listEl.replaceChildren();
    listEl.insertAdjacentHTML('beforeend', `
      <table class="data-table">
        <thead><tr><th>Empresa</th><th>Plan</th><th>Estado</th><th>Inicio</th><th>Vencimiento</th></tr></thead>
        <tbody>${data.data.map(s => `
          <tr>
            <td>${s.company?.name || '-'}</td>
            <td>${s.plan || '-'}</td>
            <td><span class="badge badge-${s.status === 'ACTIVE' ? 'success' : s.status === 'TRIAL' ? 'warning' : 'danger'}">${formatStatus(s.status, 'subscription')}</span></td>
            <td>${formatDate(s.startDate)}</td>
            <td>${formatDate(s.endDate)}</td>
          </tr>
        `).join('')}</tbody>
      </table>
    `);
  } else {
  }
}

function showBlockModal(companyId, block) {
  const action = block ? 'bloquear' : 'desbloquear';
  
  openModal({
    title: `${block ? 'Bloquear' : 'Desbloquear'} Empresa`,
    content: `<p>¿Estás seguro de que querés ${action} esta empresa?</p>`,
    confirmText: 'Confirmar',
    onConfirm: async () => {
      try {
        if (block) {
          await api.post(`/admin/companies/${companyId}/block`);
        } else {
          await api.post(`/admin/companies/${companyId}/unblock`);
        }
        showToast(`Empresa ${block ? 'bloqueada' : 'desbloqueada'}`, 'success');
        await loadCompaniesData(pageData.companies?.page, pageData.companies?.search, pageData.companies?.status);
        renderCompaniesList();
      } catch (e) {
        showToast(e.message || 'Error actualizando empresa', 'error');
      }
    }
  });
}