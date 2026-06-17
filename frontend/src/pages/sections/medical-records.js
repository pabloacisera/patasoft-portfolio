import { api } from '../../services/api.js';
import { formatDate, formatCurrency, formatStatus } from '../../utils/formatters.js';
import { createPagination } from '../../components/Pagination.js';
import Modal, { openModal } from '../../components/Modal.js';
import { showToast } from '../../components/Toast.js';
import { escapeHtml } from '../../utils/escape.js';
import { showAddRecordModal, recalcRecordTotal } from '../../components/AddRecordForm.js';
import { showFieldError, clearFieldErrors } from '../../utils/validators.js';

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
  
  content.replaceChildren();
  content.insertAdjacentHTML('beforeend', `
    <div class="page-header">
      <div id="filter-records"></div>
      <button class="btn btn-primary" id="add-record-btn">Nueva Consulta</button>
    </div>
    <div id="records-list"></div>
    <div id="records-pagination"></div>
  `);
  
  const listEl = document.getElementById('records-list');
  if (data.data?.length) {
    listEl.replaceChildren();
    listEl.insertAdjacentHTML('beforeend', `
      <table class="data-table">
        <thead><tr><th>Fecha</th><th>Mascota</th><th>Motivo</th><th>Diagnóstico</th><th>Acciones</th></tr></thead>
        <tbody>${data.data.map(r => `
          <tr>
            <td>${formatDate(r.date)}</td>
            <td>${escapeHtml(r.pet?.name) || '-'}</td>
            <td>${escapeHtml(r.visitReason)}</td>
            <td>${escapeHtml(r.diagnosis) || '-'}</td>
            <td>
              <button class="btn btn-outline btn-sm" data-id="${escapeHtml(r.id)}" data-action="view">Ver</button>
              <button class="btn btn-outline btn-sm" data-id="${escapeHtml(r.id)}" data-action="edit">Editar</button>
              <button class="btn btn-outline btn-sm" data-id="${escapeHtml(r.id)}" data-action="download-record-pdf" title="Descargar receta médica">📄 Receta</button>
              ${r.payment && r.payment.status !== 'CANCELLED' ? `<button class="btn btn-warning btn-sm" data-id="${escapeHtml(r.id)}" data-action="cancel">Cancelar</button>` : ''}
              <button class="btn btn-danger btn-sm" data-id="${escapeHtml(r.id)}" data-action="delete">Eliminar</button>
            </td>
          </tr>
        `).join('')}</tbody>
      </table>
    `);
    
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
          a.download = `consulta-${String(btn.dataset.id).padStart(6, '0')}.pdf`;
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

    listEl.querySelectorAll('[data-action="cancel"]').forEach(btn => {
      btn.addEventListener('click', () => cancelRecord(btn.dataset.id, pageData));
    });
  } else {
    listEl.replaceChildren();
    listEl.insertAdjacentHTML('beforeend', '<div class="empty-state" role="status"><p>No hay historial médico</p></div>');
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
    title: `Consulta: ${escapeHtml(record.pet?.name) || 'Mascota'} - ${formatDate(record.date)}`,
    size: 'lg',
    content: `
      <div class="detail-row"><span>Fecha:</span><span>${formatDate(record.date)}</span></div>
      <div class="detail-row"><span>Mascota:</span><span>${escapeHtml(record.pet?.name) || '-'}</span></div>
      <div class="detail-row"><span>Motivo:</span><span>${escapeHtml(record.visitReason)}</span></div>
      <div class="detail-row"><span>Diagnóstico:</span><span>${escapeHtml(record.diagnosis) || '-'}</span></div>
      <div class="detail-row"><span>Tratamiento:</span><span>${escapeHtml(record.treatment) || '-'}</span></div>
      <div class="detail-row"><span>Observaciones:</span><span>${escapeHtml(record.observations) || '-'}</span></div>
      <div class="detail-row"><span>Peso:</span><span>${escapeHtml(record.weight) || '-'}</span></div>
      <div class="detail-row"><span>Temperatura:</span><span>${record.temperature ? escapeHtml(record.temperature) + '°C' : '-'}</span></div>
      <div class="detail-row"><span>Próxima visita:</span><span>${record.nextVisitDate ? formatDate(record.nextVisitDate) : '-'}</span></div>
      ${record.payment ? `
        <hr>
        <h4>Pago asociado</h4>
        <div class="detail-row"><span>Total:</span><span>${formatCurrency(record.payment.totalAmount)}</span></div>
        <div class="detail-row"><span>Estado:</span><span>${formatStatus(record.payment.status, 'payment')}</span></div>
        <div class="detail-row"><span>Método:</span><span>${escapeHtml(record.payment.method) || '-'}</span></div>
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
          return `<div class="detail-row"><span>${escapeHtml(p.medicineName)}</span><span>${escapeHtml(detail) || '-'}</span></div>`;
        }).join('')}
      ` : ''}
      ${record.procedures?.length ? `
        <hr>
        <h4>Procedimientos</h4>
        ${record.procedures.map(p => `<div class="detail-row"><span>${escapeHtml(p.name)}</span><span>${escapeHtml(p.priceItem?.name) || ''}</span></div>`).join('')}
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
          a.download = `receta-${String(recordId).padStart(6, '0')}.pdf`;
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
          a.download = `recibo-${String(record.payment.id).padStart(6, '0')}.pdf`;
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
        <input
          type="text"
          class="form-input"
          id="edit-record-pet-search"
          placeholder="Buscar entre las últimas 50 mascotas..."
          autocomplete="off"
          style="margin-bottom:6px"
        >
        <select class="form-input" id="edit-record-petId"></select>
      </div>
      <div class="form-group">
        <label class="form-label required">Fecha</label>
        <input type="date" class="form-input" id="edit-record-date" value="${record.date ? escapeHtml(record.date.split('T')[0]) : ''}">
      </div>
      <div class="form-group">
        <label class="form-label required">Motivo de consulta</label>
        <input type="text" class="form-input" id="edit-record-reason" value="${escapeHtml(record.visitReason) || ''}">
      </div>
      <div class="form-group">
        <label class="form-label">Diagnóstico</label>
        <textarea class="form-input" id="edit-record-diagnosis" rows="3">${escapeHtml(record.diagnosis) || ''}</textarea>
      </div>
      <div class="form-group">
        <label class="form-label">Tratamiento</label>
        <textarea class="form-input" id="edit-record-treatment" rows="3">${escapeHtml(record.treatment) || ''}</textarea>
      </div>
      <div class="form-group">
        <label class="form-label">Observaciones</label>
        <textarea class="form-input" id="edit-record-observations" rows="2">${escapeHtml(record.observations) || ''}</textarea>
      </div>
    `,
    onConfirm: async () => {
      document.querySelectorAll('.field-error').forEach(el => el.remove());
      document.querySelectorAll('.input-error').forEach(el => el.classList.remove('input-error'));
      const petId = document.getElementById('edit-record-petId').value;
      const reason = document.getElementById('edit-record-reason').value.trim();
      const date = document.getElementById('edit-record-date').value;
      
      let hasError = false;
      if (!petId) { showFieldError('edit-record-petId', 'La mascota es requerida'); hasError = true; }
      if (!reason) { showFieldError('edit-record-reason', 'El motivo es requerido'); hasError = true; }
      if (!date) { showFieldError('edit-record-date', 'La fecha es requerida'); hasError = true; }
      if (hasError) return false;
      
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
  
  api.get('/pets', { limit: 50 }).then(({ data }) => {
    const petsCache = data || [];

    function renderEditPetOptions(mascotas, selectedId) {
      const sel = document.getElementById('edit-record-petId');
      if (!sel) return;
      sel.replaceChildren();
      sel.insertAdjacentHTML('beforeend',
        `<option value="">Seleccionar...</option>` +
        mascotas.map(p =>
          `<option value="${escapeHtml(p.id)}" ${p.id === selectedId ? 'selected' : ''}>${escapeHtml(p.name)}</option>`
        ).join('')
      );
    }

    renderEditPetOptions(petsCache, record.petId);

    const buscador = document.getElementById('edit-record-pet-search');
    if (buscador) {
      buscador.addEventListener('input', () => {
        const q = buscador.value.trim().toLowerCase();
        const filtradas = q
          ? petsCache.filter(p => p.name.toLowerCase().includes(q))
          : petsCache;
        renderEditPetOptions(filtradas, document.getElementById('edit-record-petId')?.value);
      });
    }
  }).catch(() => {});
}

export async function deleteRecord(recordId, pageData) {
  const confirmed = await Modal.confirm('¿Estás seguro de eliminar esta consulta?');
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

export async function cancelRecord(recordId, pageData) {
  const confirmed = await Modal.confirm('¿Estás seguro de cancelar esta consulta? Se revertirán los movimientos de stock y caja.');
  if (!confirmed) return;

  try {
    await api.post(`/medical-records/${recordId}/cancel`);
    showToast('Consulta cancelada exitosamente', 'success');
    await loadMedicalRecordsData(pageData, pageData.medicalRecords?.page || 1, pageData.medicalRecords?.petId || '');
    renderMedicalRecordsPage(document.getElementById('page-content'), pageData);
  } catch (e) {
    showToast(e.message || 'Error cancelando consulta', 'error');
  }
}


