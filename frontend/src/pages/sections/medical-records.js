import { api } from '../../services/api.js';
import { formatDate, formatCurrency, formatStatus } from '../../utils/formatters.js';
import { createPagination } from '../../components/Pagination.js';
import { openModal } from '../../components/Modal.js';
import { showToast } from '../../components/Toast.js';

export async function loadMedicalRecordsData(pageData, page = 1, petId = '') {
  try {
    const params = { page, limit: 20 };
    if (petId) params.petId = petId;
    
    const result = await api.get('/medical-records', params);
    pageData.medicalRecords = { ...result, page, petId };
  } catch (e) {
    pageData.medicalRecords = { data: [], meta: { total: 0 }, page, petId };
  }
}

export async function renderMedicalRecordsPage(content, pageData) {
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
      btn.addEventListener('click', () => showViewRecordModal(btn.dataset.id, pageData));
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
      btn.addEventListener('click', () => showEditRecordModal(btn.dataset.id, pageData));
    });
    
    listEl.querySelectorAll('[data-action="delete"]').forEach(btn => {
      btn.addEventListener('click', () => deleteRecord(btn.dataset.id, pageData));
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
        await loadMedicalRecordsData(pageData, newPage, pageData.medicalRecords?.petId || '');
        renderMedicalRecordsPage(document.getElementById('page-content'), pageData);
      }
    });
    paginationEl.appendChild(pagination);
  }
  
  document.getElementById('add-record-btn')?.addEventListener('click', () => showAddRecordModal(pageData));
}

function showViewRecordModal(recordId, pageData) {
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

export function showEditRecordModal(recordId, pageData) {
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
        await loadMedicalRecordsData(pageData, pageData.medicalRecords?.page || 1, pageData.medicalRecords?.petId || '');
        renderMedicalRecordsPage(document.getElementById('page-content'), pageData);
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

export async function deleteRecord(recordId, pageData) {
  const confirmed = window.confirm('¿Estás seguro de eliminar esta consulta?');
  if (!confirmed) return;
  
  try {
    await api.delete(`/medical-records/${recordId}`);
    showToast('Consulta eliminada', 'success');
    await loadMedicalRecordsData(pageData, pageData.medicalRecords?.page || 1, pageData.medicalRecords?.petId || '');
    renderMedicalRecordsPage(document.getElementById('page-content'), pageData);
  } catch (e) {
    showToast(e.message || 'Error eliminando consulta', 'error');
  }
}

export function showAddRecordModal(pageData) {
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
      <form id="record-form">
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
      </form>
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
        await loadMedicalRecordsData(pageData, 1, pageData.medicalRecords?.petId || '');
        renderMedicalRecordsPage(document.getElementById('page-content'), pageData);
      } catch (e) {
        showToast(e.message || 'Error creando consulta', 'error');
        return false;
      }
    }
  });
  
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
    
    const supplySel = div.querySelector('.proc-supply');
    suppliesCache.forEach(s => supplySel.innerHTML += `<option value="${s.id}">${s.name}</option>`);
    
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

export function recalcRecordTotal() {
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
