import { api } from '../../services/api.js';
import { escapeHtml } from '../../utils/escape.js';
import { createSearchBar } from '../../components/SearchBar.js';
import { VirtualScroll } from '../../utils/virtualScroll.js';
import Modal, { openModal } from '../../components/Modal.js';
import { showToast } from '../../components/Toast.js';
import { showFieldError } from '../../utils/validators.js';

let clientsController = null;
let clientsVS = null;

export async function loadClientsData(pageData, page = 1, search = '') {
  if (clientsController) clientsController.abort();
  clientsController = new AbortController();
  try {
    const params = { page, limit: 20 };
    if (search) params.search = search;
    
    const result = await api.get('/clients', params, { signal: clientsController.signal });
    pageData.clients = { ...result, page, search };
  } catch (e) {
    if (e.name === 'AbortError') return;
    pageData.clients = { data: [], meta: { total: 0 }, page, search };
  }
}

export async function renderClientsPage(content, pageData) {
  const data = pageData.clients || { data: [], meta: { total: 0 } };
  
  content.replaceChildren();
  content.insertAdjacentHTML('beforeend', `
    <div class="page-header">
      <div id="search-clients"></div>
      <button class="btn btn-primary" id="add-client-btn">Nuevo Cliente</button>
    </div>
    <div id="clients-list"></div>
    <div id="clients-pagination"></div>
  `);
  
  const searchBar = createSearchBar({
    placeholder: 'Buscar clientes...',
    initialValue: data.search || '',
    onSearch: async (query) => {
      pageData.clients.search = query;
      await loadClientsData(pageData, 1, query);
      renderClientsPage(document.getElementById('page-content'), pageData);
    }
  });
  document.getElementById('search-clients').appendChild(searchBar);
  
  const listEl = document.getElementById('clients-list');
  if (data.data?.length) {
    listEl.replaceChildren();
    listEl.insertAdjacentHTML('beforeend', `
      <table class="data-table">
        <thead><tr><th>Nombre</th><th>Email</th><th>Teléfono</th><th>Acciones</th></tr></thead>
        <tbody>${data.data.map(c => `
          <tr>
            <td>${escapeHtml(c.name)} ${escapeHtml(c.lastName || '')}</td>
            <td>${escapeHtml(c.email || '-')}</td>
            <td>${escapeHtml(c.phone || '-')}</td>
            <td>
              <button class="btn btn-outline btn-sm" data-id="${escapeHtml(c.id)}" data-action="view">Ver</button>
              <button class="btn btn-outline btn-sm" data-id="${escapeHtml(c.id)}" data-action="edit">Editar</button>
              <button class="btn btn-danger btn-sm" data-id="${escapeHtml(c.id)}" data-action="delete">Eliminar</button>
            </td>
          </tr>
        `).join('')}</tbody>
      </table>
    `);
    
    listEl.querySelectorAll('[data-action="view"]').forEach(btn => {
      btn.addEventListener('click', () => showClientDetail(btn.dataset.id, pageData));
    });
    
    listEl.querySelectorAll('[data-action="edit"]').forEach(btn => {
      btn.addEventListener('click', () => showEditClientModal(btn.dataset.id, pageData));
    });
    
    listEl.querySelectorAll('[data-action="delete"]').forEach(btn => {
      btn.addEventListener('click', () => deleteClient(btn.dataset.id, pageData));
    });
  } else {
    listEl.replaceChildren();
    listEl.insertAdjacentHTML('beforeend', '<div class="empty-state" role="status"><p>No hay clientes</p></div>');
  }
  
  if (clientsVS) clientsVS.destroy();
  if (data.meta?.totalPages > 1) {
    const tbody = document.querySelector('#clients-list tbody');
    const table = document.querySelector('#clients-list table');
    clientsVS = new VirtualScroll({
      container: table || listEl,
      tableHeadHtml: '<tr><th>Nombre</th><th>Email</th><th>Teléfono</th><th>Acciones</th></tr>',
      getTbody: () => tbody,
      pageSize: 20,
      fetchPage: async (page) => {
        const result = await api.get('/clients', { page, limit: 20, search: pageData.clients?.search || '' });
        return result;
      },
      renderRow: (c) => `
        <tr>
          <td>${escapeHtml(c.name)} ${escapeHtml(c.lastName || '')}</td>
          <td>${escapeHtml(c.email || '-')}</td>
          <td>${escapeHtml(c.phone || '-')}</td>
          <td>
            <button class="btn btn-outline btn-sm" data-id="${escapeHtml(c.id)}" data-action="view">Ver</button>
            <button class="btn btn-outline btn-sm" data-id="${escapeHtml(c.id)}" data-action="edit">Editar</button>
            <button class="btn btn-danger btn-sm" data-id="${escapeHtml(c.id)}" data-action="delete">Eliminar</button>
          </td>
        </tr>`,
      afterRender: (all) => {
        pageData.clients = { ...pageData.clients, data: all };
        const container = document.querySelector('#clients-list table') || listEl;
        container.querySelectorAll('[data-action="view"]').forEach(btn => {
          btn.addEventListener('click', () => showClientDetail(btn.dataset.id, pageData));
        });
        container.querySelectorAll('[data-action="edit"]').forEach(btn => {
          btn.addEventListener('click', () => showEditClientModal(btn.dataset.id, pageData));
        });
        container.querySelectorAll('[data-action="delete"]').forEach(btn => {
          btn.addEventListener('click', () => deleteClient(btn.dataset.id, pageData));
        });
      }
    });
    clientsVS.init(2);
  }
  
  document.getElementById('add-client-btn')?.addEventListener('click', () => showClientModal(null, pageData));
}

function showClientDetail(clientId, pageData) {
  const client = pageData.clients?.data?.find(c => c.id === clientId);
  if (!client) return;
  
  openModal({
    title: `Cliente: ${escapeHtml(client.name)} ${escapeHtml(client.lastName || '')}`,
    size: 'lg',
    content: `
      <div class="detail-row"><span>DNI:</span><span>${escapeHtml(client.dni || '-')}</span></div>
      <div class="detail-row"><span>Email:</span><span>${escapeHtml(client.email || '-')}</span></div>
      <div class="detail-row"><span>Teléfono:</span><span>${escapeHtml(client.phone || '-')}</span></div>
      <div class="detail-row"><span>Dirección:</span><span>${escapeHtml(client.address || '-')}</span></div>
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
      el.replaceChildren();
      el.insertAdjacentHTML('beforeend', pets.map(p => 
        `<div class="detail-row"><span>${escapeHtml(p.name)}</span><span>${escapeHtml(p.species || '')} ${escapeHtml(p.breed || '')}</span></div>`
      ).join(''));
    } else {
      el.replaceChildren();
      el.insertAdjacentHTML('beforeend', '<div style="color:var(--text-secondary);font-size:var(--text-sm)">No tiene mascotas registradas</div>');
    }
  }).catch(() => {
    const el = document.getElementById('client-pets-list');
    if (el) { el.replaceChildren(); el.insertAdjacentHTML('beforeend', '<div style="color:var(--text-secondary);font-size:var(--text-sm)">Error cargando mascotas</div>'); }
  });
}

export function showClientModal(clientId, pageData) {
  const isEdit = !!clientId;
  const client = isEdit ? pageData.clients?.data?.find(c => c.id === clientId) : null;
  
  openModal({
    title: isEdit ? 'Editar Cliente' : 'Nuevo Cliente',
    content: `
      <form id="client-form">
        <div class="form-group">
          <label class="form-label required">Nombre</label>
          <input type="text" class="form-input" id="client-name" value="${escapeHtml(client?.name || '')}">
        </div>
        <div class="form-group">
          <label class="form-label">Apellido</label>
          <input type="text" class="form-input" id="client-lastName" value="${escapeHtml(client?.lastName || '')}">
        </div>
        <div class="form-group">
          <label class="form-label">DNI</label>
          <input type="text" class="form-input" id="client-dni" value="${escapeHtml(client?.dni || '')}">
        </div>
        <div class="form-group">
          <label class="form-label">Email</label>
          <input type="email" class="form-input" id="client-email" value="${escapeHtml(client?.email || '')}">
        </div>
        <div class="form-group">
          <label class="form-label">Teléfono</label>
          <input type="tel" class="form-input" id="client-phone" value="${escapeHtml(client?.phone || '')}">
        </div>
        <div class="form-group">
          <label class="form-label">Dirección</label>
          <input type="text" class="form-input" id="client-address" value="${escapeHtml(client?.address || '')}">
        </div>
      </form>
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
        
        await loadClientsData(pageData, pageData.clients?.page || 1, pageData.clients?.search || '');
        renderClientsPage(document.getElementById('page-content'), pageData);
      } catch (e) {
        showToast(e.message || 'Error guardando cliente', 'error');
        return false;
      }
    }
  });
}

export function showEditClientModal(clientId, pageData) {
  showClientModal(clientId, pageData);
}

export async function deleteClient(clientId, pageData) {
  const confirmed = await Modal.confirm('¿Estás seguro de eliminar este cliente?');
  if (!confirmed) return;
  
  try {
    await api.delete(`/clients/${clientId}`);
    showToast('Cliente eliminado', 'success');
    await loadClientsData(pageData, pageData.clients?.page || 1, pageData.clients?.search || '');
    renderClientsPage(document.getElementById('page-content'), pageData);
  } catch (e) {
    showToast(e.message || 'Error eliminando cliente', 'error');
  }
}
