import { api } from '../../services/api.js';
import { createSearchBar } from '../../components/SearchBar.js';
import { createPagination } from '../../components/Pagination.js';
import { openModal } from '../../components/Modal.js';
import { showToast } from '../../components/Toast.js';
import { showFieldError } from '../../utils/validators.js';

export async function loadClientsData(pageData, page = 1, search = '') {
  try {
    const params = { page, limit: 20 };
    if (search) params.search = search;
    
    const result = await api.get('/clients', params);
    pageData.clients = { ...result, page, search };
  } catch (e) {
    pageData.clients = { data: [], meta: { total: 0 }, page, search };
  }
}

export async function renderClientsPage(content, pageData) {
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
      await loadClientsData(pageData, 1, query);
      renderClientsPage(document.getElementById('page-content'), pageData);
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
      btn.addEventListener('click', () => showClientDetail(btn.dataset.id, pageData));
    });
    
    listEl.querySelectorAll('[data-action="edit"]').forEach(btn => {
      btn.addEventListener('click', () => showEditClientModal(btn.dataset.id, pageData));
    });
    
    listEl.querySelectorAll('[data-action="delete"]').forEach(btn => {
      btn.addEventListener('click', () => deleteClient(btn.dataset.id, pageData));
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
        await loadClientsData(pageData, newPage, pageData.clients?.search || '');
        renderClientsPage(document.getElementById('page-content'), pageData);
      }
    });
    paginationEl.appendChild(pagination);
  }
  
  document.getElementById('add-client-btn')?.addEventListener('click', () => showClientModal(null, pageData));
}

function showClientDetail(clientId, pageData) {
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

export function showClientModal(clientId, pageData) {
  const isEdit = !!clientId;
  const client = isEdit ? pageData.clients?.data?.find(c => c.id === clientId) : null;
  
  openModal({
    title: isEdit ? 'Editar Cliente' : 'Nuevo Cliente',
    content: `
      <form id="client-form">
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
  const confirmed = window.confirm('¿Estás seguro de eliminar este cliente?');
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
