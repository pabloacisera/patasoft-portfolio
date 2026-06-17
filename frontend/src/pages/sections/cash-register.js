import { api } from '../../services/api.js';
import { formatCurrency, formatDateTime } from '../../utils/formatters.js';
import { createPagination } from '../../components/Pagination.js';
import { openModal } from '../../components/Modal.js';
import { showToast } from '../../components/Toast.js';
import { escapeHtml } from '../../utils/escape.js';
import { showFieldError } from '../../utils/validators.js';

export async function renderCashRegisterPage(content, pageData) {
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
  
  content.replaceChildren();
  content.insertAdjacentHTML('beforeend', `
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
      <input type="date" class="form-input" id="cash-filter-date" value="${escapeHtml(dc.date || '')}" style="width:150px" title="Fecha">
      <input type="date" class="form-input" id="cash-filter-startDate" value="${escapeHtml(dc.startDate || '')}" style="width:150px" title="Desde">
      <input type="date" class="form-input" id="cash-filter-endDate" value="${escapeHtml(dc.endDate || '')}" style="width:150px" title="Hasta">
      <select class="form-input" id="cash-filter-type" style="width:130px">
        <option value="">Todos</option>
        <option value="INCOME" ${dc.type === 'INCOME' ? 'selected' : ''}>Ingresos</option>
        <option value="EXPENSE" ${dc.type === 'EXPENSE' ? 'selected' : ''}>Egresos</option>
      </select>
      <input type="text" class="form-input" id="cash-filter-search" placeholder="Buscar concepto..." value="${escapeHtml(dc.search || '')}" style="flex:1;min-width:150px">
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
  `);
  
  renderCashTableRows(movementsData.data, pageData);
  
  if (movementsData.meta?.totalPages > 1) {
    const pagEl = document.getElementById('cash-pagination');
    const pagination = createPagination({
      total: movementsData.meta.total,
      page: movementsData.meta.page,
      limit: movementsData.meta.limit,
      onPageChange: async (newPage) => {
        dc.page = newPage;
        await renderCashRegisterPage(content, pageData);
      }
    });
    if (pagEl) pagEl.appendChild(pagination);
  }
  
  document.getElementById('income-btn')?.addEventListener('click', () => showCashMovementModal('INCOME', pageData));
  document.getElementById('expense-btn')?.addEventListener('click', () => showCashMovementModal('EXPENSE', pageData));
  
  const applyFilters = () => {
    dc.date = document.getElementById('cash-filter-date')?.value || '';
    dc.startDate = document.getElementById('cash-filter-startDate')?.value || '';
    dc.endDate = document.getElementById('cash-filter-endDate')?.value || '';
    dc.type = document.getElementById('cash-filter-type')?.value || '';
    dc.search = document.getElementById('cash-filter-search')?.value?.trim() || '';
    dc.page = 1;
    if (dc.date) { dc.startDate = ''; dc.endDate = ''; }
    renderCashRegisterPage(content, pageData);
  };
  
  document.getElementById('cash-search-btn')?.addEventListener('click', applyFilters);
  document.getElementById('cash-filter-search')?.addEventListener('keypress', (e) => { if (e.key === 'Enter') applyFilters(); });
  document.getElementById('cash-filter-type')?.addEventListener('change', applyFilters);
  document.getElementById('cash-filter-date')?.addEventListener('change', applyFilters);
  document.getElementById('cash-filter-startDate')?.addEventListener('change', applyFilters);
  document.getElementById('cash-filter-endDate')?.addEventListener('change', applyFilters);
  document.getElementById('cash-clear-btn')?.addEventListener('click', () => {
    dc.date = ''; dc.startDate = ''; dc.endDate = ''; dc.type = ''; dc.search = ''; dc.page = 1;
    renderCashRegisterPage(content, pageData);
  });
}

function renderCashTableRows(movements, pageData) {
  const tbody = document.getElementById('cash-table-body');
  if (!tbody) return;
  
  if (!movements?.length) {
    tbody.replaceChildren();
    tbody.insertAdjacentHTML('beforeend', '<tr><td colspan="6">No hay movimientos</td></tr>');
    return;
  }
  
  tbody.replaceChildren();
  tbody.insertAdjacentHTML('beforeend', movements.map(m => `
    <tr>
      <td>${formatDateTime(m.date || m.createdAt)}</td>
      <td><span class="badge badge-${m.type === 'INCOME' ? 'success' : 'danger'}">${m.type === 'INCOME' ? 'Ingreso' : 'Egreso'}</span></td>
      <td style="font-weight:600">${formatCurrency(m.amount)}</td>
      <td>${escapeHtml(m.reason || '-')}</td>
      <td>${m.payment ? formatCurrency(m.payment.totalAmount) : '-'}</td>
      <td>
        ${!m.paymentId ? `
          <button class="btn btn-outline btn-sm" data-id="${escapeHtml(m.id)}" data-action="edit-cash">Editar</button>
          <button class="btn btn-danger btn-sm" data-id="${escapeHtml(m.id)}" data-action="delete-cash">Eliminar</button>
        ` : '<span style="font-size:var(--text-xs);color:var(--text-secondary)">Vinculado</span>'}
      </td>
    </tr>
  `).join(''));
  
  tbody.querySelectorAll('[data-action="edit-cash"]').forEach(btn => {
    btn.addEventListener('click', () => showEditCashMovementModal(btn.dataset.id, pageData));
  });
  tbody.querySelectorAll('[data-action="delete-cash"]').forEach(btn => {
    btn.addEventListener('click', () => deleteCashMovement(btn.dataset.id, pageData));
  });
}

export function showCashMovementModal(type, pageData) {
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
      document.querySelectorAll('.field-error').forEach(el => el.remove());
      document.querySelectorAll('.input-error').forEach(el => el.classList.remove('input-error'));
      const amount = parseFloat(document.getElementById('cash-amount').value);
      const reason = document.getElementById('cash-reason').value.trim();
      const cashType = document.getElementById('cash-type').value;
      
      let hasError = false;
      if (!amount || amount <= 0) { showFieldError('cash-amount', 'Debe ingresar un monto válido'); hasError = true; }
      if (!reason) { showFieldError('cash-reason', 'Debe ingresar un concepto'); hasError = true; }
      if (hasError) return false;
      
      try {
        await api.post('/cash-register', { type: cashType, amount, reason });
        showToast('Movimiento registrado', 'success');
        await renderCashRegisterPage(document.getElementById('page-content'), pageData);
      } catch (e) {
        showToast(e.message || 'Error registrando movimiento', 'error');
        return false;
      }
    }
  });
}

export function showEditCashMovementModal(movementId, pageData) {
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
      document.querySelectorAll('.field-error').forEach(el => el.remove());
      document.querySelectorAll('.input-error').forEach(el => el.classList.remove('input-error'));
      const amount = parseFloat(document.getElementById('cash-edit-amount').value);
      const reason = document.getElementById('cash-edit-reason').value.trim();
      
      let hasError = false;
      if (!amount || amount <= 0) { showFieldError('cash-edit-amount', 'Debe ingresar un monto válido'); hasError = true; }
      if (!reason) { showFieldError('cash-edit-reason', 'Debe ingresar un concepto'); hasError = true; }
      if (hasError) return false;
      
      try {
        await api.patch(`/cash-register/${movementId}`, { amount, reason });
        showToast('Movimiento actualizado', 'success');
        await renderCashRegisterPage(document.getElementById('page-content'), pageData);
      } catch (e) {
        showToast(e.message || 'Error actualizando movimiento', 'error');
        return false;
      }
    }
  });
}

export async function deleteCashMovement(movementId, pageData) {
  const confirmed = await Modal.confirm('¿Estás seguro de eliminar este movimiento?');
  if (!confirmed) return;
  
  try {
    await api.delete(`/cash-register/${movementId}`);
    showToast('Movimiento eliminado', 'success');
    await renderCashRegisterPage(document.getElementById('page-content'), pageData);
  } catch (e) {
    showToast(e.message || 'Error eliminando movimiento', 'error');
  }
}
