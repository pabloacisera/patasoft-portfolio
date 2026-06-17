import { api } from '../../services/api.js';
import { formatDate, formatCurrency, formatStatus } from '../../utils/formatters.js';
import { createPagination } from '../../components/Pagination.js';
import Modal, { openModal, closeModal } from '../../components/Modal.js';
import { showToast } from '../../components/Toast.js';
import { escapeHtml } from '../../utils/escape.js';
import { showFieldError } from '../../utils/validators.js';

let paymentItemCounter = 0;
let paymentsController = null;
let debtsController = null;

export async function loadPaymentsData(pageData, page = 1, status = '') {
  if (paymentsController) paymentsController.abort();
  paymentsController = new AbortController();
  try {
    const params = { page, limit: 20 };
    if (status) params.status = status;
    
    const result = await api.get('/payments', params, { signal: paymentsController.signal });
    pageData.payments = { ...result, page, status };
  } catch (e) {
    if (e.name === 'AbortError') return;
    pageData.payments = { data: [], meta: { total: 0 }, page, status };
  }
}

export async function loadDebtsData(pageData, page = 1, status = '') {
  if (debtsController) debtsController.abort();
  debtsController = new AbortController();
  try {
    const params = { page, limit: 20 };
    if (status) params.status = status;
    
    const result = await api.get('/debts', params, { signal: debtsController.signal });
    pageData.debts = { ...result, page, status };
  } catch (e) {
    if (e.name === 'AbortError') return;
    pageData.debts = { data: [], meta: { total: 0 }, page, status };
  }
}

export async function renderPaymentsPage(content, pageData) {
  const payments = pageData.payments?.data || [];
  const debts = pageData.debts?.data || [];
  
  content.replaceChildren();
  content.insertAdjacentHTML('beforeend', `
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
  `);
  
  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
      document.getElementById(`tab-${tab.dataset.tab}`).classList.add('active');
    });
  });
  
  document.getElementById('new-payment-btn')?.addEventListener('click', () => showAddPaymentModal(pageData));
  
  const paymentsEl = document.getElementById('payments-list');
  if (payments.length) {
    paymentsEl.replaceChildren();
    paymentsEl.insertAdjacentHTML('beforeend', `
      <table class="data-table">
        <thead><tr><th>Fecha</th><th>Cliente</th><th>Total</th><th>Estado</th><th>Método</th><th>Acciones</th></tr></thead>
        <tbody>${payments.map(p => `
          <tr>
            <td>${formatDate(p.createdAt)}</td>
            <td>${escapeHtml(p.client?.name) || '-'}</td>
            <td>${formatCurrency(p.totalAmount)}</td>
            <td><span class="badge badge-${p.status === 'PAID' ? 'success' : p.status === 'PENDING' ? 'warning' : 'danger'}">${formatStatus(p.status, 'payment')}</span></td>
            <td>${escapeHtml(p.method) || '-'}</td>
            <td><button class="btn btn-outline btn-sm" data-id="${escapeHtml(p.id)}" data-action="view-payment">Ver</button></td>
          </tr>
        `).join('')}</tbody>
      </table>
    `);
    
    paymentsEl.querySelectorAll('[data-action="view-payment"]').forEach(btn => {
      btn.addEventListener('click', () => showPaymentDetail(btn.dataset.id, pageData));
    });
    paymentsEl.querySelectorAll('[data-action="download-receipt"]').forEach(btn => {
      btn.addEventListener('click', async () => {
        try {
          const blob = await api.getBlob(`/payments/${btn.dataset.id}/receipt`);
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `recibo-${String(btn.dataset.id).padStart(6, '0')}.pdf`;
          a.click();
          URL.revokeObjectURL(url);
        } catch (e) {
          showToast('Error al generar el PDF', 'error');
        }
      });
    });
  } else {
    paymentsEl.replaceChildren();
    paymentsEl.insertAdjacentHTML('beforeend', '<div class="empty-state" role="status"><p>No hay cobros</p></div>');
  }

  const paymentsPaginationEl = document.getElementById('payments-pagination');
  if (pageData.payments?.meta?.totalPages > 1) {
    const pagination = createPagination({
      total: pageData.payments.meta.total,
      page: pageData.payments.page || 1,
      limit: 20,
      onPageChange: async (newPage) => {
        await loadPaymentsData(pageData, newPage, pageData.payments?.status || '');
        renderPaymentsPage(document.getElementById('page-content'), pageData);
      }
    });
    paymentsPaginationEl.appendChild(pagination);
  }
  
  const debtsEl = document.getElementById('debts-list');
  if (debts.length) {
    debtsEl.replaceChildren();
    debtsEl.insertAdjacentHTML('beforeend', `
      <table class="data-table">
        <thead><tr><th>Cliente</th><th>Monto</th><th>Vencimiento</th><th>Estado</th><th>Acciones</th></tr></thead>
        <tbody>${debts.map(d => `
          <tr>
            <td>${escapeHtml(d.client?.name) || '-'}</td>
            <td>${formatCurrency(d.amount)}</td>
            <td>${formatDate(d.dueDate)}</td>
            <td><span class="badge badge-${d.status === 'PAID' ? 'success' : d.status === 'OVERDUE' ? 'danger' : 'warning'}">${formatStatus(d.status, 'debt')}</span></td>
            <td>
              ${d.status !== 'PAID' ? `<button class="btn btn-outline btn-sm" data-id="${escapeHtml(d.id)}" data-action="pay-debt">Pagar</button>` : ''}
              ${d.status !== 'PAID' && d.status !== 'CANCELLED' ? `<button class="btn btn-outline btn-sm" data-id="${escapeHtml(d.id)}" data-action="cancel-debt">Cancelar</button>` : ''}
            </td>
          </tr>
        `).join('')}</tbody>
      </table>
    `);
    
    debtsEl.querySelectorAll('[data-action="pay-debt"]').forEach(btn => {
      btn.addEventListener('click', async () => {
        try {
          await api.patch(`/debts/${btn.dataset.id}/pay`);
          showToast('Deuda marcada como pagada', 'success');
          await loadDebtsData(pageData, pageData.debts?.page || 1, '');
          renderPaymentsPage(document.getElementById('page-content'), pageData);
        } catch (e) {
          showToast(e.message || 'Error actualizando deuda', 'error');
        }
      });
    });
    
    debtsEl.querySelectorAll('[data-action="cancel-debt"]').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (!(await Modal.confirm('¿Cancelar esta deuda?'))) return;
        try {
          await api.patch(`/debts/${btn.dataset.id}/cancel`);
          showToast('Deuda cancelada', 'success');
          await loadDebtsData(pageData, pageData.debts?.page || 1, '');
          renderPaymentsPage(document.getElementById('page-content'), pageData);
        } catch (e) {
          showToast(e.message || 'Error cancelando deuda', 'error');
        }
      });
    });
  } else {
    debtsEl.replaceChildren();
    debtsEl.insertAdjacentHTML('beforeend', '<div class="empty-state" role="status"><p>No hay deudas</p></div>');
  }
}

export function showAddPaymentModal(pageData) {
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
      <form id="payment-form">
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
      </form>
    `,
    confirmText: 'Crear Cobro',
    onConfirm: async () => {
      let clientId = document.getElementById('pay-clientId').value;
      
      if (clientId === '__new__') {
        const name = document.getElementById('quick-client-name').value.trim();
        if (!name) {
          showFieldError('quick-client-name', 'El nombre del cliente es requerido');
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
        await Promise.all([loadPaymentsData(pageData, 1, ''), loadDebtsData(pageData, 1, '')]);
        renderPaymentsPage(document.getElementById('page-content'), pageData);
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
      clientsCache.map(c => `<option value="${escapeHtml(c.id)}">${escapeHtml(c.name)} ${escapeHtml(c.lastName) || ''}</option>`).join('');
    sel.replaceChildren();
    sel.insertAdjacentHTML('beforeend', options);
  }
  
  document.getElementById('pay-clientId')?.addEventListener('change', (e) => {
    const val = e.target.value;
    const quickForm = document.getElementById('new-client-quick-form');
    if (quickForm) quickForm.style.display = val === '__new__' ? 'block' : 'none';
    
    const petSel = document.getElementById('pay-petId');
    if (!petSel) return;
    petSel.replaceChildren();
    petSel.insertAdjacentHTML('beforeend', '<option value="">Seleccionar...</option>');
    if (val && val !== '__new__') {
      api.get(`/clients/${val}/pets`).then(pets => {
        if (pets.length) pets.forEach(p => petSel.insertAdjacentHTML('beforeend', `<option value="${escapeHtml(p.id)}">${escapeHtml(p.name)}</option>`));
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
    div.replaceChildren();
    div.insertAdjacentHTML('beforeend', `
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
    `);
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
      dropdown.replaceChildren();
      dropdown.insertAdjacentHTML('beforeend', matches.map(s => 
        `<div class="supply-option" data-id="${escapeHtml(s.id)}" data-name="${escapeHtml(s.name)}" data-price="${escapeHtml(s.salePrice || s.unitPrice || 0)}">
          <span>${escapeHtml(s.name)}${s.brand ? ' - ' + escapeHtml(s.brand) : ''}</span>
          <span>${formatCurrency(s.salePrice || s.unitPrice || 0)}</span>
        </div>`
      ).join(''));
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

export function recalcPaymentTotal() {
  let total = 0;
  document.querySelectorAll('.payment-item-row').forEach(row => {
    const qty = parseInt(row.querySelector('.pay-item-qty')?.value) || 0;
    const price = parseFloat(row.querySelector('.pay-item-price')?.value) || 0;
    total += qty * price;
  });
  const el = document.getElementById('pay-total');
  if (el) el.value = '$' + total.toFixed(2);
}

export async function showPaymentDetail(paymentId, pageData) {
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
      <tbody>${payment.items.map(i => `<tr><td>${escapeHtml(i.description)}</td><td>${escapeHtml(i.quantity)}</td><td>${formatCurrency(i.unitPrice)}</td><td>${formatCurrency(i.totalPrice)}</td></tr>`).join('')}</tbody>
    </table>
  ` : '';
  
  const receiptHTML = payment.status === 'PAID'
    ? `<button class="btn btn-outline btn-sm" id="pay-download-receipt-btn">🧾 Descargar comprobante</button>`
    : '';

  const deleteHTML = `<button class="btn btn-outline btn-sm" id="pay-delete-btn" style="color:var(--color-danger);border-color:var(--color-danger)">Eliminar cobro</button>`;
  
  openModal({
    title: `Cobro #${escapeHtml(String(payment.id).padStart(6, '0'))}`,
    size: 'medium',
    content: `
      <div class="detail-row"><span>Fecha</span><span>${formatDate(payment.createdAt)}</span></div>
      <div class="detail-row"><span>Cliente</span><span>${escapeHtml(payment.client?.name) || 'Sin cliente'}</span></div>
      <div class="detail-row"><span>Mascota</span><span>${escapeHtml(payment.pet?.name) || '-'}</span></div>
      <div class="detail-row"><span>Método</span><span>${methodLabels[method] || escapeHtml(method) || '-'}</span></div>
      <div class="detail-row"><span>Estado</span><span class="badge badge-${payment.status === 'PAID' ? 'success' : 'warning'}">${formatStatus(payment.status, 'payment')}</span></div>
      <div class="detail-row"><span>Total</span><span style="font-size:var(--text-xl);font-weight:700">${formatCurrency(payment.totalAmount)}</span></div>
      ${payment.notes ? `<div class="detail-row"><span>Notas</span><span>${escapeHtml(payment.notes)}</span></div>` : ''}
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
  
  setTimeout(() => {
    document.getElementById('pay-confirm-cash')?.addEventListener('click', async () => {
      try {
        await api.patch(`/payments/${paymentId}`, { status: 'PAID', paidAt: new Date().toISOString() });
        showToast(`Cobro confirmado - ingreso en caja: ${formatCurrency(payment.totalAmount)}`, 'success');
        closeModal();
        await loadPaymentsData(pageData, pageData.payments?.page || 1, '');
        renderPaymentsPage(document.getElementById('page-content'), pageData);
      } catch (e) {
        showToast(e.message || 'Error', 'error');
      }
    });
    
    document.getElementById('pay-confirm-transfer')?.addEventListener('click', async () => {
      try {
        await api.patch(`/payments/${paymentId}`, { status: 'PAID', paidAt: new Date().toISOString() });
        showToast(`Transferencia confirmada - ingreso en caja: ${formatCurrency(payment.totalAmount)}`, 'success');
        closeModal();
        await loadPaymentsData(pageData, pageData.payments?.page || 1, '');
        renderPaymentsPage(document.getElementById('page-content'), pageData);
      } catch (e) {
        showToast(e.message || 'Error', 'error');
      }
    });
    
    document.getElementById('pay-confirm-generic')?.addEventListener('click', async () => {
      try {
        await api.patch(`/payments/${paymentId}`, { status: 'PAID', paidAt: new Date().toISOString() });
        showToast(`Cobro confirmado - ingreso en caja: ${formatCurrency(payment.totalAmount)}`, 'success');
        closeModal();
        await loadPaymentsData(pageData, pageData.payments?.page || 1, '');
        renderPaymentsPage(document.getElementById('page-content'), pageData);
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
      if (!(await Modal.confirm('¿Estás seguro de eliminar este cobro? Se aplicará como eliminación lógica.'))) return;
      try {
        await api.delete(`/payments/${paymentId}`);
        showToast('Cobro eliminado', 'success');
        closeModal();
        await loadPaymentsData(pageData, pageData.payments?.page || 1, '');
        renderPaymentsPage(document.getElementById('page-content'), pageData);
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

export function showQRModal(paymentId) {
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
      if (container) { container.replaceChildren(); container.insertAdjacentHTML('beforeend', '<div style="padding:40px;color:var(--text-secondary)">Regenerando QR...</div>'); }
      
      timerTimeout = setTimeout(async () => {
        try {
          const result = await api.post('/mercadopago/qr', { paymentId });
          if (container) {
            container.replaceChildren();
            container.insertAdjacentHTML('beforeend', `<img src="https://api.qrserver.com/v1/create-qr-code/?size=280x280&data=${encodeURIComponent(result.qrData)}" style="border:2px solid var(--border);border-radius:var(--radius)">`);
          }
          seconds = 120;
          if (countdown) countdown.style.display = '';
          countdownInterval = setInterval(updateCountdown, 1000);
          updateCountdown();
        } catch (e) {
          if (container) { container.replaceChildren(); container.insertAdjacentHTML('beforeend', '<div style="padding:40px;color:var(--color-danger)">Error regenerando QR</div>'); }
        }
      }, 1500);
    }
  };
  
  openQR();
}
