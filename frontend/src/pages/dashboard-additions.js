// ============================================
// FUNCIONES DE CARGA DE DATOS FALTANTES
// ============================================

import { renderPagination } from '../components/Pagination.js';

async function loadClientsData(page = 1, search = '') {
  try {
    const result = await api.get(`/clients?page=${page}&limit=20&search=${encodeURIComponent(search)}`);
    pageData.clients = { page, search, data: result.data, total: result.meta.total };
    return result;
  } catch (e) {
    console.error('[loadClientsData]', e);
    showToast(e.message || 'Error cargando clientes', 'error');
    return { data: [], meta: { total: 0 } };
  }
}

async function loadPetsData(page = 1, search = '') {
  try {
    const result = await api.get(`/pets?page=${page}&limit=20&search=${encodeURIComponent(search)}`);
    pageData.pets = { page, search, data: result.data, total: result.meta.total };
    return result;
  } catch (e) {
    console.error('[loadPetsData]', e);
    showToast(e.message || 'Error cargando mascotas', 'error');
    return { data: [], meta: { total: 0 } };
  }
}

async function loadMedicalRecordsData(page = 1, filters = {}) {
  try {
    const params = new URLSearchParams({ page, limit: 20 });
    if (filters.petId) params.append('petId', filters.petId);
    const result = await api.get(`/medical-records?${params}`);
    pageData.medicalRecords = { page, filters, data: result.data, total: result.meta.total };
    return result;
  } catch (e) {
    console.error('[loadMedicalRecordsData]', e);
    showToast(e.message || 'Error cargando consultas', 'error');
    return { data: [], meta: { total: 0 } };
  }
}

async function loadPaymentsData(page = 1, status = '') {
  try {
    const result = await api.get(`/payments?page=${page}&limit=20&status=${status}`);
    pageData.payments = { page, status, data: result.data, total: result.meta.total };
    return result;
  } catch (e) {
    console.error('[loadPaymentsData]', e);
    showToast(e.message || 'Error cargando pagos', 'error');
    return { data: [], meta: { total: 0 } };
  }
}

async function loadDebtsData(page = 1, status = '') {
  try {
    const result = await api.get(`/debts?page=${page}&limit=20&status=${status}`);
    pageData.debts = { page, status, data: result.data, total: result.meta.total };
    return result;
  } catch (e) {
    console.error('[loadDebtsData]', e);
    showToast(e.message || 'Error cargando deudas', 'error');
    return { data: [], meta: { total: 0 } };
  }
}

async function loadSuppliesData(page = 1, search = '') {
  try {
    const result = await api.get(`/supplies?page=${page}&limit=20&search=${encodeURIComponent(search)}`);
    pageData.supplies = { ...result, page, search, data: result.data, meta: result.meta, total: result.meta?.total };
    return result;
  } catch (e) {
    console.error('[loadSuppliesData]', e);
    showToast(e.message || 'Error cargando insumos', 'error');
    return { data: [], meta: { total: 0 } };
  }
}

async function loadPriceItemsData(page = 1, search = '') {
  try {
    const result = await api.get(`/price-items?page=${page}&limit=20&search=${encodeURIComponent(search)}`);
    pageData.priceItems = { page, search, data: result.data, total: result.meta.total };
    return result;
  } catch (e) {
    console.error('[loadPriceItemsData]', e);
    showToast(e.message || 'Error cargando precios', 'error');
    return { data: [], meta: { total: 0 } };
  }
}

async function loadConnectionsData(page = 1, status = '') {
  try {
    const result = await api.get(`/connections?page=${page}&limit=20&status=${status}`);
    pageData.settingsConnections = { page, status, data: result.data, total: result.meta.total };
    return result;
  } catch (e) {
    console.error('[loadConnectionsData]', e);
    showToast(e.message || 'Error cargando conexiones', 'error');
    return { data: [], meta: { total: 0 } };
  }
}

async function loadCashRegisterData(page = 1, date = '') {
  try {
    const params = new URLSearchParams({ page, limit: 20 });
    if (date) params.append('date', date);
    const result = await api.get(`/cash-register?${params}`);
    pageData.cashRegister = { page, date, data: result, total: result.length };
    
    const summary = await api.get(`/cash-register/summary?${date ? 'date=' + date : ''}`);
    pageData.cashRegister.summary = summary;
    
    return result;
  } catch (e) {
    console.error('[loadCashRegisterData]', e);
    showToast(e.message || 'Error cargando caja', 'error');
    return { data: [], meta: { total: 0 } };
  }
}

async function loadHomeData() {
  try {
    const [summary, recentClients, recentPets] = await Promise.all([
      api.get('/dashboard/summary').catch(() => ({ pets: 0, clients: 0, payments: 0, pendingDebts: 0 })),
      api.get('/clients?page=1&limit=5').catch(() => ({ data: [] })),
      api.get('/pets?page=1&limit=5').catch(() => ({ data: [] })),
    ]);
    pageData.home = { summary, recentClients: recentClients.data, recentPets: recentPets.data };
    return pageData.home;
  } catch (e) {
    console.error('[loadHomeData]', e);
    pageData.home = { summary: {}, recentClients: [], recentPets: [] };
    return pageData.home;
  }
}

// ============================================
// RENDER PAGES FALTANTES
// ============================================

export async function renderDashboardPage(pageName) {
  const content = document.getElementById('page-content');
  if (!content) {
    await new Promise(r => setTimeout(r, 100));
    return renderDashboardPage(pageName);
  }

  const pages = {
    'home': renderDashboardHomeContent,
    'clients': renderClientsContent,
    'pets': renderPetsContent,
    'medical-records': renderMedicalRecordsContent,
    'payments': renderPaymentsContent,
    'supplies': renderSuppliesContent,
    'chat': renderAIChatContent,
    'cash-register': renderCashRegisterContent,
  };

  const renderFn = pages[pageName];
  if (renderFn) {
    await renderFn(content);
  } else {
    content.innerHTML = '<div class="empty-state">Página no encontrada</div>';
  }
}

async function renderDashboardHomeContent(content) {
  const data = pageData.home || await loadHomeData();
  const { summary } = data;
  
  content.innerHTML = `
    <style>
      .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: var(--space-4); margin-bottom: var(--space-6); }
      .stat-card { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-lg); padding: var(--space-4); }
      .stat-label { font-size: var(--text-sm); color: var(--text-secondary); margin-bottom: var(--space-1); }
      .stat-value { font-size: var(--text-2xl); font-weight: 700; color: var(--text-primary); }
      .recent-section { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-lg); padding: var(--space-4); margin-bottom: var(--space-4); }
      .recent-title { font-size: var(--text-lg); font-weight: 600; margin-bottom: var(--space-3); }
      .recent-list { display: flex; flex-direction: column; gap: var(--space-2); }
      .recent-item { display: flex; justify-content: space-between; padding: var(--space-2); border-bottom: 1px solid var(--border); }
    </style>
    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-label">Mascotas</div>
        <div class="stat-value">${summary.pets || 0}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Clientes</div>
        <div class="stat-value">${summary.clients || 0}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Pagos del mes</div>
        <div class="stat-value">${summary.payments || 0}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Deudas pendientes</div>
        <div class="stat-value">${summary.pendingDebts || 0}</div>
      </div>
    </div>
    <div class="recent-section">
      <div class="recent-title">Clientes Recientes</div>
      <div class="recent-list">
        ${data.recentClients?.map(c => `
          <div class="recent-item">
            <span>${c.name} ${c.lastName || ''}</span>
            <small>${c.phone || ''}</small>
          </div>
        `).join('') || '<div>No hay clientes</div>'}
      </div>
    </div>
    <div class="recent-section">
      <div class="recent-title">Mascotas Recientes</div>
      <div class="recent-list">
        ${data.recentPets?.map(p => `
          <div class="recent-item">
            <span>${p.name}</span>
            <small>${p.species}</small>
          </div>
        `).join('') || '<div>No hay mascotas</div>'}
      </div>
    </div>
  `;
}

async function renderClientsContent(content) {
  const { data: clients, meta } = pageData.clients || await loadClientsData(1, '');
  
  content.innerHTML = `
    <div class="page-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--space-4);">
      <h2>Clientes</h2>
      <button class="btn btn-primary" id="add-client-btn">+ Nuevo Cliente</button>
    </div>
    <div class="search-bar" style="margin-bottom: var(--space-4);">
      <input type="text" class="form-input" id="clients-search" placeholder="Buscar clientes..." value="${pageData.clients?.search || ''}">
    </div>
    <div class="table-container">
      <table class="data-table">
        <thead>
          <tr>
            <th>Nombre</th>
            <th>Teléfono</th>
            <th>Email</th>
            <th>Mascotas</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody id="clients-table-body">
          ${clients.length === 0 ? '<tr><td colspan="5">No hay clientes</td></tr>' : ''}
        </tbody>
      </table>
    </div>
    <div id="clients-pagination"></div>
  `;

  renderClientsTable(clients);
  
  if (meta?.total > 20) {
    const pagination = createPagination({
      total: meta.total,
      page: meta.page,
      limit: meta.limit,
      onPageChange: async (newPage) => {
        await loadClientsData(newPage, pageData.clients?.search || '');
        renderClientsTable(pageData.clients?.data || []);
        updatePagination(document.getElementById('clients-pagination'), {
          total: meta.total,
          page: newPage,
          limit: meta.limit,
          onPageChange: renderClientsContent,
        });
      }
    });
    document.getElementById('clients-pagination').appendChild(pagination);
  }

  document.getElementById('add-client-btn')?.addEventListener('click', () => openModal('client-form'));
  document.getElementById('clients-search')?.addEventListener('input', debounce(async (e) => {
    await loadClientsData(1, e.target.value);
    renderClientsTable(pageData.clients?.data || []);
  }, 400));
}

function renderClientsTable(clients) {
  const tbody = document.getElementById('clients-table-body');
  if (!tbody) return;
  
  tbody.innerHTML = clients.map(c => `
    <tr data-client-id="${c.id}">
      <td>${c.name} ${c.lastName || ''}</td>
      <td>${c.phone || '-'}</td>
      <td>${c.email || '-'}</td>
      <td>${c.pets?.length || 0}</td>
      <td>
        <button class="btn btn-sm btn-outline edit-client-btn" data-id="${c.id}">Editar</button>
        <button class="btn btn-sm btn-danger delete-client-btn" data-id="${c.id}">Eliminar</button>
      </td>
    </tr>
  `).join('');

  tbody.querySelectorAll('.edit-client-btn').forEach(btn => {
    btn.addEventListener('click', () => openEditClientModal(btn.dataset.id));
  });
  
  tbody.querySelectorAll('.delete-client-btn').forEach(btn => {
    btn.addEventListener('click', () => deleteClient(btn.dataset.id));
  });
}

async function openEditClientModal(clientId) {
  try {
    const client = await api.get(`/clients/${clientId}`);
    openModal('client-form', {
      title: 'Editar Cliente',
      data: client,
    });
  } catch (e) {
    showToast(e.message || 'Error cargando cliente', 'error');
  }
}

async function deleteClient(clientId) {
  if (!confirm('¿Estás seguro de eliminar este cliente?')) return;
  
  try {
    await api.delete(`/clients/${clientId}`);
    showToast('Cliente eliminado', 'success');
    await loadClientsData(pageData.clients?.page || 1, pageData.clients?.search || '');
    renderClientsTable(pageData.clients?.data || []);
  } catch (e) {
    showToast(e.message || 'Error eliminando cliente', 'error');
  }
}

async function renderPetsContent(content) {
  const { data: pets, meta } = pageData.pets || await loadPetsData(1, '');
  
  content.innerHTML = `
    <div class="page-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--space-4);">
      <h2>Mascotas</h2>
      <button class="btn btn-primary" id="add-pet-btn">+ Nueva Mascota</button>
    </div>
    <div class="search-bar" style="margin-bottom: var(--space-4);">
      <input type="text" class="form-input" id="pets-search" placeholder="Buscar mascotas..." value="${pageData.pets?.search || ''}">
    </div>
    <div class="table-container">
      <table class="data-table">
        <thead>
          <tr>
            <th>Nombre</th>
            <th>Especie</th>
            <th>Raza</th>
            <th>Dueño</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody id="pets-table-body">
          ${pets.length === 0 ? '<tr><td colspan="5">No hay mascotas</td></tr>' : ''}
        </tbody>
      </table>
    </div>
    <div id="pets-pagination"></div>
  `;

  renderPetsTable(pets);
  
  if (meta?.total > 20) {
    const pagination = createPagination({
      total: meta.total,
      page: meta.page,
      limit: meta.limit,
      onPageChange: async (newPage) => {
        await loadPetsData(newPage, pageData.pets?.search || '');
        renderPetsTable(pageData.pets?.data || []);
      }
    });
    document.getElementById('pets-pagination').appendChild(pagination);
  }

  document.getElementById('add-pet-btn')?.addEventListener('click', () => openModal('pet-form'));
  document.getElementById('pets-search')?.addEventListener('input', debounce(async (e) => {
    await loadPetsData(1, e.target.value);
    renderPetsTable(pageData.pets?.data || []);
  }, 400));
}

function renderPetsTable(pets) {
  const tbody = document.getElementById('pets-table-body');
  if (!tbody) return;
  
  tbody.innerHTML = pets.map(p => `
    <tr data-pet-id="${p.id}">
      <td>${p.name}</td>
      <td>${formatSpecies(p.species)}</td>
      <td>${p.breed || '-'}</td>
      <td>${p.client?.name || '-'}</td>
      <td>
        <button class="btn btn-sm btn-outline view-pet-btn" data-id="${p.id}">Ver</button>
        <button class="btn btn-sm btn-outline edit-pet-btn" data-id="${p.id}">Editar</button>
        <button class="btn btn-sm btn-danger delete-pet-btn" data-id="${p.id}">Eliminar</button>
      </td>
    </tr>
  `).join('');

  tbody.querySelectorAll('.view-pet-btn').forEach(btn => {
    btn.addEventListener('click', () => router.navigate(`/dashboard/pets/${btn.dataset.id}`));
  });
  
  tbody.querySelectorAll('.edit-pet-btn').forEach(btn => {
    btn.addEventListener('click', () => openEditPetModal(btn.dataset.id));
  });
  
  tbody.querySelectorAll('.delete-pet-btn').forEach(btn => {
    btn.addEventListener('click', () => deletePet(btn.dataset.id));
  });
}

async function openEditPetModal(petId) {
  try {
    const pet = await api.get(`/pets/${petId}`);
    openModal('pet-form', { title: 'Editar Mascota', data: pet });
  } catch (e) {
    showToast(e.message || 'Error cargando mascota', 'error');
  }
}

async function deletePet(petId) {
  if (!confirm('¿Estás seguro de eliminar esta mascota?')) return;
  
  try {
    await api.delete(`/pets/${petId}`);
    showToast('Mascota eliminada', 'success');
    await loadPetsData(pageData.pets?.page || 1, pageData.pets?.search || '');
    renderPetsTable(pageData.pets?.data || []);
  } catch (e) {
    showToast(e.message || 'Error eliminando mascota', 'error');
  }
}

async function renderMedicalRecordsContent(content) {
  const { data: records, meta } = pageData.medicalRecords || await loadMedicalRecordsData(1, {});
  
  content.innerHTML = `
    <div class="page-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--space-4);">
      <h2>Consultas</h2>
      <button class="btn btn-primary" id="add-record-btn">+ Nueva Consulta</button>
    </div>
    <div class="table-container">
      <table class="data-table">
        <thead>
          <tr>
            <th>Fecha</th>
            <th>Mascota</th>
            <th>Motivo</th>
            <th>Diagnóstico</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody id="records-table-body">
          ${records.length === 0 ? '<tr><td colspan="5">No hay consultas</td></tr>' : ''}
        </tbody>
      </table>
    </div>
    <div id="records-pagination"></div>
  `;

  renderMedicalRecordsTable(records);
  
  if (meta?.total > 20) {
    const pagination = createPagination({
      total: meta.total,
      page: meta.page,
      limit: meta.limit,
      onPageChange: async (newPage) => {
        await loadMedicalRecordsData(newPage, pageData.medicalRecords?.filters || {});
        renderMedicalRecordsTable(pageData.medicalRecords?.data || []);
      }
    });
    document.getElementById('records-pagination').appendChild(pagination);
  }

  document.getElementById('add-record-btn')?.addEventListener('click', () => openModal('medical-record-form'));
}

function renderMedicalRecordsTable(records) {
  const tbody = document.getElementById('records-table-body');
  if (!tbody) return;
  
  tbody.innerHTML = records.map(r => `
    <tr data-record-id="${r.id}">
      <td>${formatDate(r.date)}</td>
      <td>${r.pet?.name || '-'}</td>
      <td>${r.visitReason}</td>
      <td>${r.diagnosis || '-'}</td>
      <td>
        <button class="btn btn-sm btn-outline view-record-btn" data-id="${r.id}">Ver</button>
      </td>
    </tr>
  `).join('');

  tbody.querySelectorAll('.view-record-btn').forEach(btn => {
    btn.addEventListener('click', () => router.navigate(`/dashboard/medical-records/${btn.dataset.id}`));
  });
}

async function renderPaymentsContent(content) {
  const { data: payments } = pageData.payments || await loadPaymentsData(1, '');
  const { data: debts } = pageData.debts || await loadDebtsData(1, '');
  
  content.innerHTML = `
    <h2>Pagos y Deudas</h2>
    <div class="tabs" style="display: flex; gap: var(--space-2); margin-bottom: var(--space-4); border-bottom: 1px solid var(--border);">
      <button class="tab-btn active" data-tab="payments">Pagos</button>
      <button class="tab-btn" data-tab="debts">Deudas</button>
    </div>
    <div id="payments-section">
      <table class="data-table">
        <thead>
          <tr>
            <th>Fecha</th>
            <th>Cliente</th>
            <th>Monto</th>
            <th>Estado</th>
            <th>Método</th>
          </tr>
        </thead>
        <tbody id="payments-table-body">
          ${payments.length === 0 ? '<tr><td colspan="5">No hay pagos</td></tr>' : ''}
        </tbody>
      </table>
    </div>
    <div id="debts-section" style="display: none;">
      <table class="data-table">
        <thead>
          <tr>
            <th>Fecha</th>
            <th>Cliente</th>
            <th>Monto</th>
            <th>Estado</th>
            <th>Vencimiento</th>
          </tr>
        </thead>
        <tbody id="debts-table-body">
          ${debts.length === 0 ? '<tr><td colspan="5">No hay deudas</td></tr>' : ''}
        </tbody>
      </table>
    </div>
  `;

  renderPaymentsTable(payments);
  renderDebtsTable(debts);

  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const tab = btn.dataset.tab;
      document.getElementById('payments-section').style.display = tab === 'payments' ? 'block' : 'none';
      document.getElementById('debts-section').style.display = tab === 'debts' ? 'block' : 'none';
    });
  });
}

function renderPaymentsTable(payments) {
  const tbody = document.getElementById('payments-table-body');
  if (!tbody) return;
  
  tbody.innerHTML = payments.map(p => `
    <tr>
      <td>${formatDate(p.createdAt)}</td>
      <td>${p.client?.name || '-'}</td>
      <td>${formatCurrency(p.totalAmount)}</td>
      <td>${formatStatus(p.status)}</td>
      <td>${p.method || '-'}</td>
    </tr>
  `).join('');
}

function renderDebtsTable(debts) {
  const tbody = document.getElementById('debts-table-body');
  if (!tbody) return;
  
  tbody.innerHTML = debts.map(d => `
    <tr>
      <td>${formatDate(d.createdAt)}</td>
      <td>${d.client?.name || '-'}</td>
      <td>${formatCurrency(d.amount)}</td>
      <td>${formatStatus(d.status)}</td>
      <td>${formatDate(d.dueDate)}</td>
    </tr>
  `).join('');
}

async function renderSuppliesContent(content) {
  const { data: supplies, meta } = pageData.supplies || await loadSuppliesData(1, '');
  
  content.innerHTML = `
    <div class="page-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--space-4);">
      <h2>Insumos</h2>
      <button class="btn btn-primary" id="add-supply-btn">+ Nuevo Insumo</button>
    </div>
    <div class="search-bar" style="margin-bottom: var(--space-4);">
      <input type="text" class="form-input" id="supplies-search" placeholder="Buscar insumos...">
    </div>
    <div class="table-container">
      <table class="data-table">
        <thead>
          <tr>
            <th>Nombre</th>
            <th>Categoría</th>
            <th>Stock</th>
            <th>Precio</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody id="supplies-table-body">
          ${supplies.length === 0 ? '<tr><td colspan="5">No hay insumos</td></tr>' : ''}
        </tbody>
      </table>
    </div>
    <div id="supplies-pagination"></div>
  `;

  renderSuppliesTable(supplies);
  
  const paginationEl = document.getElementById('supplies-pagination');
  if (paginationEl && meta) {
    const totalPages = meta.totalPages || Math.ceil((meta.total || 0) / (meta.limit || 20));
    if (totalPages > 1) {
      const pagination = renderPagination({
        total: meta.total || 0,
        page: meta.page || 1,
        limit: meta.limit || 20,
        onPageChange: async (newPage) => {
          await loadSuppliesData(newPage, pageData.supplies?.search || '');
          const content = document.getElementById('page-content');
          if (content) await renderSuppliesContent(content);
        }
      });
      paginationEl.innerHTML = '';
      paginationEl.appendChild(pagination);
    }
  }
}

function renderSuppliesTable(supplies) {
  const tbody = document.getElementById('supplies-table-body');
  if (!tbody) return;
  
  tbody.innerHTML = supplies.map(s => `
    <tr>
      <td>${s.name}</td>
      <td>${s.category || '-'}</td>
      <td>${s.quantity} ${s.unit || ''}</td>
      <td>${formatCurrency(s.salePrice || s.unitPrice)}</td>
      <td>
        <button class="btn btn-sm btn-outline" data-id="${s.id}">Editar</button>
      </td>
    </tr>
  `).join('');
}

async function renderAIChatContent(content) {
  content.innerHTML = `
    <h2>Asistente IA</h2>
    <div id="chat-container" style="height: 400px; overflow-y: auto; border: 1px solid var(--border); border-radius: var(--radius-lg); padding: var(--space-4); margin-bottom: var(--space-4); background: var(--surface);">
      <div class="chat-message system">¡Hola! Soy tu asistente de IA. ¿En qué puedo ayudarte hoy?</div>
    </div>
    <div style="display: flex; gap: var(--space-2);">
      <input type="text" class="form-input" id="chat-input" placeholder="Escribe tu mensaje..." style="flex: 1;">
      <button class="btn btn-primary" id="send-chat-btn">Enviar</button>
    </div>
  `;

  document.getElementById('send-chat-btn')?.addEventListener('click', sendChatMessage);
  document.getElementById('chat-input')?.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') sendChatMessage();
  });
  
  async function sendChatMessage() {
    const input = document.getElementById('chat-input');
    const container = document.getElementById('chat-container');
    const message = input.value.trim();
    if (!message) return;
    
    container.innerHTML += `<div class="chat-message user">${message}</div>`;
    container.innerHTML += `<div class="chat-message system">Pensando...</div>`;
    input.value = '';
    container.scrollTop = container.scrollHeight;
    
    try {
      const response = await api.post('/ai/chat', { message });
      const lastMsg = container.querySelectorAll('.chat-message.system');
      if (lastMsg.length) {
        lastMsg[lastMsg.length - 1].textContent = response.response || response.message || 'Respuesta recibida';
      }
    } catch (e) {
      container.innerHTML += `<div class="chat-message error">Error: ${e.message}</div>`;
    }
  }
}

async function renderCashRegisterContent(content) {
  const summary = pageData.cashRegister?.summary || await api.get('/cash-register/summary').catch(() => ({ income: 0, expenses: 0, balance: 0 }));
  
  content.innerHTML = `
    <style>
      .cash-summary { display: grid; grid-template-columns: repeat(3, 1fr); gap: var(--space-4); margin-bottom: var(--space-6); }
      .cash-card { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-lg); padding: var(--space-4); text-align: center; }
      .cash-card.income { border-color: var(--color-success); }
      .cash-card.expense { border-color: var(--color-danger); }
      .cash-label { font-size: var(--text-sm); color: var(--text-secondary); }
      .cash-amount { font-size: var(--text-2xl); font-weight: 700; }
    </style>
    <div class="page-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--space-4);">
      <h2>Caja</h2>
      <div style="display: flex; gap: var(--space-2);">
        <button class="btn btn-success" id="income-btn">+ Ingreso</button>
        <button class="btn btn-danger" id="expense-btn">- Egreso</button>
      </div>
    </div>
    <div class="cash-summary">
      <div class="cash-card income">
        <div class="cash-label">Ingresos</div>
        <div class="cash-amount">${formatCurrency(summary.income || 0)}</div>
      </div>
      <div class="cash-card expense">
        <div class="cash-label">Egresos</div>
        <div class="cash-amount">${formatCurrency(summary.expenses || 0)}</div>
      </div>
      <div class="cash-card">
        <div class="cash-label">Saldo</div>
        <div class="cash-amount">${formatCurrency(summary.balance || 0)}</div>
      </div>
    </div>
    <h3>Movimientos</h3>
    <div class="table-container">
      <table class="data-table">
        <thead>
          <tr>
            <th>Fecha</th>
            <th>Tipo</th>
            <th>Monto</th>
            <th>Concepto</th>
          </tr>
        </thead>
        <tbody id="cash-table-body">
          <tr><td colspan="4">Cargando...</td></tr>
        </tbody>
      </table>
    </div>
    <div id="cash-pagination"></div>
  `;

  const movements = await loadCashRegisterData(1, '');
  renderCashTable(movements);

  document.getElementById('income-btn')?.addEventListener('click', () => openModal('cash-movement-form', { type: 'INCOME' }));
  document.getElementById('expense-btn')?.addEventListener('click', () => openModal('cash-movement-form', { type: 'EXPENSE' }));
}

function renderCashTable(movements) {
  const tbody = document.getElementById('cash-table-body');
  if (!tbody) return;
  
  if (!movements?.length) {
    tbody.innerHTML = '<tr><td colspan="4">No hay movimientos</td></tr>';
    return;
  }
  
  tbody.innerHTML = movements.map(m => `
    <tr>
      <td>${formatDateTime(m.date)}</td>
      <td>${m.type === 'INCOME' ? 'Ingreso' : 'Egreso'}</td>
      <td>${formatCurrency(m.amount)}</td>
      <td>${m.reason || '-'}</td>
    </tr>
  `).join('');
}

// ============================================
// MODALES FALTANTES
// ============================================

function initModals() {
  const modals = {
    'client-form': {
      title: 'Nuevo Cliente',
      fields: [
        { name: 'name', label: 'Nombre', type: 'text', required: true },
        { name: 'lastName', label: 'Apellido', type: 'text' },
        { name: 'dni', label: 'DNI', type: 'text' },
        { name: 'email', label: 'Email', type: 'email' },
        { name: 'phone', label: 'Teléfono', type: 'tel' },
        { name: 'address', label: 'Dirección', type: 'text' },
      ],
      onSubmit: async (data) => {
        const clientId = data.id;
        if (clientId) {
          await api.patch(`/clients/${clientId}`, data);
          showToast('Cliente actualizado', 'success');
        } else {
          await api.post('/clients', data);
          showToast('Cliente creado', 'success');
        }
        closeModal();
        await loadClientsData(pageData.clients?.page || 1, pageData.clients?.search || '');
        renderClientsTable(pageData.clients?.data || []);
      }
    },
    'pet-form': {
      title: 'Nueva Mascota',
      fields: [
        { name: 'clientId', label: 'Cliente', type: 'select', required: true, options: [] },
        { name: 'name', label: 'Nombre', type: 'text', required: true },
        { name: 'species', label: 'Especie', type: 'select', required: true, options: [
          { value: 'DOG', label: 'Perro' },
          { value: 'CAT', label: 'Gato' },
          { value: 'BIRD', label: 'Ave' },
          { value: 'OTHER', label: 'Otro' },
        ]},
        { name: 'breed', label: 'Raza', type: 'text' },
        { name: 'gender', label: 'Género', type: 'select', options: [
          { value: 'MALE', label: 'Macho' },
          { value: 'FEMALE', label: 'Hembra' },
        ]},
        { name: 'birthDate', label: 'Fecha de nacimiento', type: 'date' },
        { name: 'weight', label: 'Peso (kg)', type: 'number' },
        { name: 'color', label: 'Color', type: 'text' },
        { name: 'notes', label: 'Notas', type: 'textarea' },
      ],
      onSubmit: async (data) => {
        const petId = data.id;
        if (petId) {
          await api.patch(`/pets/${petId}`, data);
          showToast('Mascota actualizada', 'success');
        } else {
          await api.post('/pets', data);
          showToast('Mascota creada', 'success');
        }
        closeModal();
        await loadPetsData(pageData.pets?.page || 1, pageData.pets?.search || '');
        renderPetsTable(pageData.pets?.data || []);
      }
    },
    'cash-movement-form': {
      title: 'Movimiento de Caja',
      fields: [
        { name: 'type', label: 'Tipo', type: 'select', required: true, options: [
          { value: 'INCOME', label: 'Ingreso' },
          { value: 'EXPENSE', label: 'Egreso' },
        ]},
        { name: 'amount', label: 'Monto', type: 'number', required: true },
        { name: 'reason', label: 'Concepto', type: 'text', required: true },
      ],
      onSubmit: async (data) => {
        try {
          await api.post('/cash-register', data);
          showToast('Movimiento registrado', 'success');
          closeModal();
          await renderCashRegisterContent(document.getElementById('page-content'));
        } catch (e) {
          showToast(e.message || 'Error al registrar movimiento', 'error');
        }
      }
    },
    'medical-record-form': {
      title: 'Nueva Consulta',
      fields: [
        { name: 'petId', label: 'Mascota', type: 'select', required: true },
        { name: 'date', label: 'Fecha', type: 'datetime-local' },
        { name: 'visitReason', label: 'Motivo de consulta', type: 'text', required: true },
        { name: 'diagnosis', label: 'Diagnóstico', type: 'textarea' },
        { name: 'treatment', label: 'Tratamiento', type: 'textarea' },
        { name: 'weight', label: 'Peso (kg)', type: 'number' },
        { name: 'temperature', label: 'Temperatura (°C)', type: 'number' },
        { name: 'observations', label: 'Observaciones', type: 'textarea' },
        { name: 'nextVisitDate', label: 'Próxima fecha', type: 'date' },
      ],
      onSubmit: async (data) => {
        try {
          await api.post('/medical-records', data);
          showToast('Consulta registrada', 'success');
          closeModal();
          await loadMedicalRecordsData(pageData.medicalRecords?.page || 1, {});
          renderMedicalRecordsTable(pageData.medicalRecords?.data || []);
        } catch (e) {
          showToast(e.message || 'Error al registrar consulta', 'error');
        }
      }
    },
  };
  
  window.modalConfigs = modals;
}

function debounce(fn, delay) {
  let timeout;
  return (...args) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => fn(...args), delay);
  };
}

// Inicializar modales
if (typeof window !== 'undefined') {
  window.addEventListener('DOMContentLoaded', initModals);
}

export { loadClientsData, loadPetsData, loadMedicalRecordsData, loadPaymentsData, loadDebtsData, loadSuppliesData, loadPriceItemsData, loadConnectionsData, loadCashRegisterData, loadHomeData, renderClientsTable, renderPetsTable, renderMedicalRecordsTable, renderPaymentsTable, renderDebtsTable, renderSuppliesTable, renderCashTable };