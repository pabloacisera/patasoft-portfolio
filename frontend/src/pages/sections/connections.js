import { api } from '../../services/api.js';
import { formatDate, formatStatus } from '../../utils/formatters.js';
import { openModal, closeModal } from '../../components/Modal.js';
import { showToast } from '../../components/Toast.js';

export async function loadConnectionsData(pageData, page = 1, status = '') {
  try {
    const params = { page, limit: 20 };
    if (status) params.status = status;
    
    const result = await api.get('/connections', params);
    pageData.connections = { ...result, page, status };
  } catch (e) {
    pageData.connections = { data: [], meta: { total: 0 }, page, status };
  }
}

export async function renderConnectionsPage(content, pageData) {
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
          await loadConnectionsData(pageData, pageData.connections?.page || 1, '');
          renderConnectionsPage(document.getElementById('page-content'), pageData);
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
                await loadConnectionsData(pageData, pageData.connections?.page || 1, '');
                renderConnectionsPage(document.getElementById('page-content'), pageData);
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
