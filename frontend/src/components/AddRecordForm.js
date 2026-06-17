import { api } from '../services/api.js';
import { openModal } from './Modal.js';
import { showToast } from './Toast.js';
import { escapeHtml } from '../utils/escape.js';
import { formatCurrency } from '../utils/formatters.js';
import { showFieldError } from '../utils/validators.js';

export function showAddRecordModal(pageData) {
  let suppliesCache = [];
  let priceItemsCache = [];
  let allPetsCache = [];
  let allClientsCache = [];
  let currentStep = 1;
  const TOTAL_STEPS = 5;
  const MAX_PHOTOS = 3;
  const uploadedPhotos = [];
  let prescriptionSupplies = [];

  Promise.all([
    api.get('/supplies', { limit: 200 }).catch(() => ({ data: [] })),
    api.get('/price-items', { limit: 200 }).catch(() => ({ data: [] })),
    api.get('/pets', { limit: 200 }).catch(() => ({ data: [] })),
    api.get('/clients', { limit: 200 }).catch(() => ({ data: [] })),
  ]).then(([suppRes, priceRes, petsRes, clientsRes]) => {
    suppliesCache = suppRes.data || [];
    priceItemsCache = priceRes.data || [];
    allPetsCache = petsRes.data || [];
    allClientsCache = clientsRes.data || [];

    renderPetOptions(allPetsCache, null);
    renderClientOptions(allClientsCache, null);

    const buscadorMascota = document.getElementById('record-pet-search');
    if (buscadorMascota) {
      buscadorMascota.addEventListener('input', () => {
        const q = buscadorMascota.value.trim().toLowerCase();
        const filtradas = q
          ? allPetsCache.filter(p =>
              `${p.name} ${p.client?.name || ''} ${p.client?.lastName || ''}`.toLowerCase().includes(q))
          : allPetsCache;
        renderPetOptions(filtradas, document.getElementById('record-petId')?.value);
      });
    }
  });

  function renderPetOptions(mascotas, selectedId) {
    const sel = document.getElementById('record-petId');
    if (!sel) return;
    sel.replaceChildren();
    sel.insertAdjacentHTML('beforeend',
      `<option value="">Seleccionar...</option>` +
      mascotas.map(p => {
        const owner = p.client ? `(${escapeHtml(p.client.name)} ${escapeHtml(p.client.lastName || '')})` : '(Sin dueño)';
        return `<option value="${escapeHtml(p.id)}" ${p.id === selectedId ? 'selected' : ''}>${escapeHtml(p.name)} ${owner}</option>`;
      }).join('')
    );
  }

  function renderClientOptions(clientes, selectedId) {
    const sel = document.getElementById('fast-clientId');
    if (!sel) return;
    sel.replaceChildren();
    sel.insertAdjacentHTML('beforeend',
      `<option value="">Seleccionar...</option>` +
      clientes.map(c =>
        `<option value="${escapeHtml(c.id)}" ${c.id === selectedId ? 'selected' : ''}>${escapeHtml(c.name)} ${escapeHtml(c.lastName || '')}</option>`
      ).join('')
    );
  }

  function goToStep(step) {
    currentStep = step;
    for (let i = 1; i <= TOTAL_STEPS; i++) {
      const el = document.getElementById(`step-${i}`);
      const dot = document.getElementById(`step-dot-${i}`);
      if (el) el.style.display = i === step ? 'block' : 'none';
      if (dot) {
        dot.className = i < step ? 'step-dot completed' : i === step ? 'step-dot active' : 'step-dot';
      }
    }
    document.getElementById('prev-btn').style.display = step === 1 ? 'none' : 'inline-block';
    const nextBtn = document.getElementById('next-btn');
    if (nextBtn) {
      if (step === TOTAL_STEPS) {
        nextBtn.textContent = 'Guardar Consulta';
        nextBtn.className = 'btn btn-primary';
      } else {
        nextBtn.textContent = 'Siguiente';
        nextBtn.className = 'btn btn-primary';
      }
    }
  }

  async function validateStep(step) {
    document.querySelectorAll('.field-error').forEach(el => el.remove());
    document.querySelectorAll('.input-error').forEach(el => el.classList.remove('input-error'));

    if (step === 1) {
      const petId = document.getElementById('record-petId').value;
      const reason = document.getElementById('record-reason').value.trim();
      const date = document.getElementById('record-date').value;
      let ok = true;
      if (!petId) { showFieldError('record-petId', 'Seleccioná una mascota'); ok = false; }
      if (!reason) { showFieldError('record-reason', 'El motivo es requerido'); ok = false; }
      if (!date) { showFieldError('record-date', 'La fecha es requerida'); ok = false; }
      return ok;
    }
    return true;
  }

  function closeModalCallback() {
    // Intencionalmente vacío - solo cierra
  }

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
          .prescription-subrow { background: var(--bg); border-top: 1px solid var(--border); margin-top: 6px; padding-top: 6px; font-size: var(--text-sm); }
          .step-progress { display:flex; gap:4px; margin-bottom:var(--space-4); align-items:center; }
          .step-dot { width:32px; height:32px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:13px; font-weight:600; background:var(--bg); color:var(--text-secondary); border:2px solid var(--border); cursor:pointer; }
          .step-dot.active { background:var(--primary); color:white; border-color:var(--primary); }
          .step-dot.completed { background:var(--success); color:white; border-color:var(--success); }
          .step-label { font-size:11px; color:var(--text-secondary); text-align:center; flex:1; }
          .step-bar { flex:1; height:2px; background:var(--border); margin:0 4px; }
          .step-bar.completed { background:var(--success); }
          .nav-buttons { display:flex; justify-content:space-between; margin-top:var(--space-4); padding-top:var(--space-3); border-top:1px solid var(--border); }
          .photo-thumb { width:80px; height:80px; object-fit:cover; border-radius:var(--radius); border:1px solid var(--border); cursor:pointer; }
          .photo-thumb:hover { opacity:0.8; }
          .photo-zone { display:flex; gap:8px; flex-wrap:wrap; margin-top:8px; }
          .cash-indicator { font-size:var(--text-xs); padding:4px 8px; border-radius:4px; display:inline-block; margin-top:4px; }
          .cash-indicator.active { background:#dcfce7; color:#166534; }
          .cash-indicator.inactive { background:#f5f5f5; color:#999; }
        </style>

        <!-- STEPPER -->
        <div class="step-progress">
          <div class="step-dot active" id="step-dot-1" data-step="1">1</div>
          <div class="step-bar" id="step-bar-1"></div>
          <div class="step-dot" id="step-dot-2" data-step="2">2</div>
          <div class="step-bar" id="step-bar-2"></div>
          <div class="step-dot" id="step-dot-3" data-step="3">3</div>
          <div class="step-bar" id="step-bar-3"></div>
          <div class="step-dot" id="step-dot-4" data-step="4">4</div>
          <div class="step-bar" id="step-bar-4"></div>
          <div class="step-dot" id="step-dot-5" data-step="5">5</div>
        </div>

        <!-- STEP 1: PACIENTE -->
        <div id="step-1">
          <div class="record-section">
            <div class="record-section-title">Paciente</div>
            <p class="section-desc">Seleccioná la mascota o creala rápidamente si no existe.</p>
            <div class="form-row">
              <div class="form-group" style="flex:1">
                <label class="form-label required">Mascota</label>
                <input type="text" class="form-input" id="record-pet-search" placeholder="Buscar mascota por nombre o dueño..." autocomplete="off" style="margin-bottom:6px">
                <select class="form-input" id="record-petId"></select>
              </div>
              <div class="form-group" style="flex:0">
                <label class="form-label">&nbsp;</label>
                <button type="button" class="btn btn-outline btn-sm" id="quick-pet-btn" style="white-space:nowrap">+ Mascota rápida</button>
              </div>
              <div class="form-group" style="flex:1">
                <label class="form-label required">Fecha</label>
                <input type="datetime-local" class="form-input" id="record-date" value="${new Date().toISOString().slice(0, 16)}">
              </div>
            </div>
            <div class="form-group">
              <label class="form-label required">Motivo de consulta</label>
              <input type="text" class="form-input" id="record-reason">
            </div>
          </div>
        </div>

        <!-- STEP 2: EXAMEN CLÍNICO -->
        <div id="step-2" style="display:none">
          <div class="record-section">
            <div class="record-section-title">Examen Clínico</div>
            <p class="section-desc">Completá los datos del examen. Todos los campos son opcionales.</p>
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
            <div class="form-group">
              <label class="form-label">Fotos (máx ${MAX_PHOTOS})</label>
              <input type="file" id="record-photo-input" accept="image/*" multiple style="display:none">
              <button type="button" class="btn btn-outline btn-sm" id="upload-photo-btn">+ Agregar foto</button>
              <span style="font-size:var(--text-xs);color:var(--text-secondary);margin-left:8px">${MAX_PHOTOS} fotos máx., ${MAX_PHOTOS - uploadedPhotos.length} disponibles</span>
              <div class="photo-zone" id="photo-zone"></div>
            </div>
          </div>
        </div>

        <!-- STEP 3: PROCEDIMIENTOS E INSUMOS -->
        <div id="step-3" style="display:none">
          <div class="record-section">
            <div class="record-section-title">
              Procedimientos e Insumos
              <button type="button" class="btn btn-outline btn-sm" id="add-procedure-btn">+ Agregar</button>
            </div>
            <p class="section-desc">Servicios realizados. Si un procedimiento requiere insumos, asocialos en la misma fila.</p>
            <div id="procedures-container"></div>
            <div class="record-section" style="margin-top:var(--space-3);padding-top:var(--space-3);border-top:1px solid var(--border)">
              <div class="record-section-title">
                Insumos sueltos
                <button type="button" class="btn btn-outline btn-sm" id="add-supply-item-btn">+ Insumo suelto</button>
              </div>
              <p class="section-desc">Insumos cobrados sin procedimiento asociado.</p>
              <div id="supply-items-container"></div>
            </div>
          </div>
        </div>

        <!-- STEP 4: PRESCRIPCIÓN -->
        <div id="step-4" style="display:none">
          <div class="record-section">
            <div class="record-section-title">Prescripción Médica</div>
            <p class="section-desc">Escribí la indicación para el dueño. Activá "Modo completo" para agregar insumos de stock que se facturan y descuentan stock.</p>
            <div class="form-group">
              <label class="form-label required">Prescripción</label>
              <textarea class="form-input" id="prescription-instructions" rows="4" placeholder="Ej: Masajes 3 veces/día por 10 min. Antibiótico cada 12hs x 7 días."></textarea>
            </div>
            <div class="form-group" style="margin-top:12px">
              <label class="form-label" style="display:flex;align-items:center;gap:8px;cursor:pointer">
                <input type="checkbox" id="prescription-complete-mode" style="width:auto">
                <span>Modo completo (agregar insumos de stock para facturar)</span>
              </label>
            </div>
            <div id="prescription-supplies" style="display:none; margin-top:12px; padding-top:12px; border-top:1px solid var(--border)">
              <div class="record-section-title" style="margin-bottom:8px">
                Insumos a dispensar en clínica
                <button type="button" class="btn btn-outline btn-sm" id="add-prescription-supply-btn">+ Agregar insumo</button>
              </div>
              <p class="section-desc">Cada insumo se factura y descuenta stock. El precio se calcula automáticamente desde la configuración del insumo.</p>
              <div id="prescription-supplies-list"></div>
            </div>
          </div>
        </div>

        <!-- STEP 5: COBRO -->
        <div id="step-5" style="display:none">
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
                <div class="cash-indicator inactive" id="cash-indicator">💰 Genera movimiento de caja</div>
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
        </div>

        <!-- NAVEGACIÓN -->
        <div class="nav-buttons">
          <button type="button" class="btn btn-outline" id="prev-btn" style="display:none">◀ Anterior</button>
          <span></span>
          <button type="button" class="btn btn-primary" id="next-btn">Siguiente</button>
        </div>
      </form>
    `,
    showConfirm: false,
    showCancel: false,
    onConfirm: closeModalCallback,
  });

  // === NAVEGACIÓN ===
  document.getElementById('next-btn')?.addEventListener('click', async () => {
    if (currentStep === TOTAL_STEPS) {
      await handleSubmit();
      return;
    }
    const valid = await validateStep(currentStep);
    if (!valid) return;
    goToStep(currentStep + 1);
  });

  document.getElementById('prev-btn')?.addEventListener('click', () => {
    if (currentStep > 1) goToStep(currentStep - 1);
  });

  for (let i = 1; i <= TOTAL_STEPS; i++) {
    document.getElementById(`step-dot-${i}`)?.addEventListener('click', () => {
      if (i < currentStep) goToStep(i);
    });
  }

  // === QUICK PET CREATION ===
  document.getElementById('quick-pet-btn')?.addEventListener('click', () => {
    const overlay = document.getElementById('quick-pet-overlay');
    if (overlay) {
      overlay.style.display = overlay.style.display === 'none' ? 'block' : 'none';
      return;
    }
    const formRow = document.getElementById('step-1').querySelector('.form-row');
    const quickDiv = document.createElement('div');
    quickDiv.id = 'quick-pet-overlay';
    quickDiv.style.cssText = 'margin-top:12px;padding:12px;background:var(--bg);border:1px solid var(--primary);border-radius:var(--radius-lg)';
    quickDiv.innerHTML = `
      <div style="font-weight:600;margin-bottom:8px;color:var(--primary);">+ Mascota rápida (sin recargar la página)</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
        <div class="form-group"><label class="form-label required">Nombre</label><input class="form-input" id="fast-name" placeholder="Nombre de la mascota"></div>
        <div class="form-group"><label class="form-label">Especie</label><input class="form-input" id="fast-species" placeholder="Ej: Perro, Gato"></div>
        <div class="form-group"><label class="form-label">Raza</label><input class="form-input" id="fast-breed" placeholder="Raza"></div>
        <div class="form-group"><label class="form-label">Color</label><input class="form-input" id="fast-color" placeholder="Color"></div>
        <div class="form-group"><label class="form-label">Género</label>
          <select class="form-input" id="fast-gender"><option value="">-</option><option value="MALE">Macho</option><option value="FEMALE">Hembra</option></select>
        </div>
        <div class="form-group"><label class="form-label">Peso (kg)</label><input type="number" class="form-input" id="fast-weight" step="0.1"></div>
        <div class="form-group" style="grid-column:1/3">
          <label class="form-label">Dueño</label>
          <input type="text" class="form-input" id="fast-client-search" placeholder="Buscar dueño existente..." autocomplete="off" style="margin-bottom:6px">
          <select class="form-input" id="fast-clientId"><option value="">Sin dueño (mascota callejera)</option></select>
          <button type="button" class="btn btn-link btn-sm" id="fast-new-client-toggle" style="margin-top:4px">+ Crear dueño nuevo</button>
          <div id="fast-new-client" style="display:none;margin-top:8px;padding:8px;background:var(--surface);border:1px solid var(--border);border-radius:var(--radius)">
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px">
              <input class="form-input" id="fast-c-name" placeholder="Nombre *">
              <input class="form-input" id="fast-c-lastName" placeholder="Apellido">
              <input class="form-input" id="fast-c-phone" placeholder="Teléfono">
              <input class="form-input" id="fast-c-email" placeholder="Email">
              <input class="form-input" id="fast-c-cuil" placeholder="CUIL/DNI" style="grid-column:1/2">
              <input class="form-input" id="fast-c-address" placeholder="Dirección" style="grid-column:2/3">
            </div>
          </div>
        </div>
      </div>
      <div style="display:flex;gap:8px;margin-top:8px">
        <button class="btn btn-primary btn-sm" id="fast-save-btn">Crear mascota</button>
        <button class="btn btn-outline btn-sm" id="fast-cancel-btn">Cancelar</button>
      </div>
    `;
    formRow.parentElement.appendChild(quickDiv);

    // Poblar select de dueños rápidos
    renderClientOptions(allClientsCache, null);

    document.getElementById('fast-client-search')?.addEventListener('input', () => {
      const q = document.getElementById('fast-client-search').value.trim().toLowerCase();
      const filtrados = q
        ? allClientsCache.filter(c => `${c.name} ${c.lastName || ''}`.toLowerCase().includes(q))
        : allClientsCache;
      renderClientOptions(filtrados, document.getElementById('fast-clientId')?.value);
    });

    document.getElementById('fast-new-client-toggle')?.addEventListener('click', () => {
      const el = document.getElementById('fast-new-client');
      el.style.display = el.style.display === 'none' ? 'block' : 'none';
    });

    document.getElementById('fast-cancel-btn')?.addEventListener('click', () => quickDiv.remove());

    document.getElementById('fast-save-btn')?.addEventListener('click', async () => {
      const name = document.getElementById('fast-name')?.value?.trim();
      if (!name) { showToast('El nombre de la mascota es requerido', 'error'); return; }
      const clientId = document.getElementById('fast-clientId')?.value;
      let newClientId = clientId || null;

      if (!clientId) {
        const cName = document.getElementById('fast-c-name')?.value?.trim();
        if (cName) {
          try {
            const newClient = await api.post('/clients', {
              name: cName,
              lastName: document.getElementById('fast-c-lastName')?.value?.trim() || undefined,
              phone: document.getElementById('fast-c-phone')?.value?.trim() || undefined,
              email: document.getElementById('fast-c-email')?.value?.trim() || undefined,
              cuil: document.getElementById('fast-c-cuil')?.value?.trim() || undefined,
              address: document.getElementById('fast-c-address')?.value?.trim() || undefined,
            });
            newClientId = newClient.id;
            allClientsCache.push(newClient);
          } catch (e) {
            showToast(e.message || 'Error creando dueño', 'error');
            return;
          }
        }
      }

      try {
        const newPet = await api.post('/pets', {
          name,
          species: document.getElementById('fast-species')?.value?.trim() || undefined,
          breed: document.getElementById('fast-breed')?.value?.trim() || undefined,
          color: document.getElementById('fast-color')?.value?.trim() || undefined,
          gender: document.getElementById('fast-gender')?.value || undefined,
          weight: parseFloat(document.getElementById('fast-weight')?.value) || undefined,
          clientId: newClientId,
        });
        allPetsCache.push(newPet);
        renderPetOptions(allPetsCache, newPet.id);
        document.getElementById('record-pet-search').value = '';
        document.getElementById('record-pet-search').placeholder = `${newPet.name} creada - click en el select`;
        showToast('Mascota creada exitosamente', 'success');
        quickDiv.remove();
      } catch (e) {
        showToast(e.message || 'Error creando mascota', 'error');
      }
    });
  });

  // === PHOTO UPLOAD (STEP 2) ===
  document.getElementById('upload-photo-btn')?.addEventListener('click', () => {
    document.getElementById('record-photo-input')?.click();
  });

  document.getElementById('record-photo-input')?.addEventListener('change', (e) => {
    const files = Array.from(e.target.files || []);
    const available = MAX_PHOTOS - uploadedPhotos.length;
    if (files.length > available) {
      showToast(`Solo podés agregar ${available} foto(s) más`, 'error');
      e.target.value = '';
      return;
    }
    const zone = document.getElementById('photo-zone');
    files.forEach(file => {
      if (!file.type.startsWith('image/')) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        const dataUrl = ev.target.result;
        uploadedPhotos.push({ base64: dataUrl, mimeType: file.type });
        const div = document.createElement('div');
        div.style.position = 'relative';
        div.innerHTML = `
          <img src="${dataUrl}" class="photo-thumb">
          <button class="btn btn-danger btn-sm photo-remove" style="position:absolute;top:-4px;right:-4px;padding:2px 6px;font-size:10px">X</button>
        `;
        div.querySelector('.photo-remove').addEventListener('click', () => {
          const idx = uploadedPhotos.findIndex(p => p.base64 === dataUrl);
          if (idx >= 0) uploadedPhotos.splice(idx, 1);
          div.remove();
          updatePhotoCounter();
        });
        zone.appendChild(div);
        updatePhotoCounter();
      };
      reader.readAsDataURL(file);
    });
    e.target.value = '';
  });

  function updatePhotoCounter() {
    const label = document.querySelector('#upload-photo-btn')?.nextElementSibling;
    if (label) label.textContent = `${MAX_PHOTOS} fotos máx., ${MAX_PHOTOS - uploadedPhotos.length} disponibles`;
  }

  const toId = (val) => {
    const n = parseInt(val, 10);
    return Number.isInteger(n) && n > 0 ? n : undefined;
  };

  // === HANDLE SUBMIT ===
  async function handleSubmit() {

    document.querySelectorAll('.field-error').forEach(el => el.remove());
    document.querySelectorAll('.input-error').forEach(el => el.classList.remove('input-error'));

    const petId = toId(document.getElementById('record-petId').value);
    const reason = document.getElementById('record-reason').value.trim();
    const date = document.getElementById('record-date').value;

    let hasError = false;
    if (!petId) { showFieldError('record-petId', 'La mascota es requerida'); hasError = true; }
    if (!reason) { showFieldError('record-reason', 'El motivo es requerido'); hasError = true; }
    if (!date) { showFieldError('record-date', 'La fecha es requerida'); hasError = true; }
    if (hasError) return false;

    const prescriptions = [];
    const instructions = document.getElementById('prescription-instructions')?.value?.trim();
    if (instructions) {
      prescriptions.push({ medicineName: instructions });
    }
    if (document.getElementById('prescription-complete-mode')?.checked) {
      prescriptionSupplies.forEach(s => {
        if (s.supplyId) {
          prescriptions.push({
            medicineName: s.supplyName,
            supplyId: s.supplyId,
            soldInClinic: true,
            dispensingQuantity: s.dispensingQuantity,
            dispensingUnit: s.dispensingUnit,
          });
        }
      });
    }

    const procedures = [];
    document.querySelectorAll('.procedure-row').forEach(row => {
      const name = row.querySelector('.proc-name')?.value?.trim();
      const priceItemId = toId(row.querySelector('.proc-priceItem')?.value);
      const customPrice = parseFloat(row.querySelector('.proc-customPrice')?.value) || 0;
      const quantity = parseInt(row.querySelector('.proc-quantity')?.value) || 1;
      const supplyId = toId(row.querySelector('.proc-supply')?.dataset?.supplyId);
      if (name) {
        procedures.push({ name, priceItemId, customPrice, quantity, supplyId });
      }
    });

    const supplyItems = [];
    document.querySelectorAll('.supply-item-row').forEach(row => {
      const desc = row.querySelector('.si-desc')?.value?.trim();
      const qty = parseInt(row.querySelector('.si-qty')?.value) || 1;
      const price = parseFloat(row.querySelector('.si-price')?.value) || 0;
      const supplyId = toId(row.dataset.supplyId);
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

    if (uploadedPhotos.length) {
      payload.photos = uploadedPhotos.map(p => ({ base64: p.base64, mimeType: p.mimeType }));
    }

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
      showToast('Guardando consulta... Verificando existencias...', 'info');
      const result = await api.post('/medical-records', payload);
      showToast('Consulta creada exitosamente', 'success');
      const mod = await import('../pages/sections/medical-records.js');
      await mod.loadMedicalRecordsData(pageData, 1, pageData.medicalRecords?.petId || '');
      mod.renderMedicalRecordsPage(document.getElementById('page-content'), pageData);

      if (result.payment) {
        setTimeout(async () => {
          const prescBtn = document.getElementById('download-prescription-btn');
          const receiptBtn = document.getElementById('download-receipt-btn');
          if (prescBtn && result.record?.id) {
            prescBtn.addEventListener('click', async () => {
              try {
                const blob = await api.getBlob(`/medical-records/${result.record.id}/pdf`);
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `receta-${String(result.record.id).padStart(6, '0')}.pdf`;
                a.click();
                URL.revokeObjectURL(url);
              } catch (e) { showToast('Error al generar la receta', 'error'); }
            });
          }
          if (receiptBtn && result.payment?.id) {
            receiptBtn.addEventListener('click', async () => {
              try {
                const blob = await api.getBlob(`/medical-records/${result.record.id}/receipt`);
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `comprobante-${String(result.payment.id).padStart(6, '0')}.pdf`;
                a.click();
                URL.revokeObjectURL(url);
              } catch (e) { showToast('Error al generar el comprobante', 'error'); }
            });
          }
        }, 100);
      }
    } catch (e) {
      showToast(e.message || 'Error creando consulta', 'error');
    }
  }

  // === PROCEDURE AUTOCOMPLETE HANDLER ===
  function setupAutocomplete(input, items, displayFn, onSelect) {
    let dropdown = null;
    const closeDropdown = () => { if (dropdown) { dropdown.remove(); dropdown = null; } };

    input.addEventListener('input', () => {
      closeDropdown();
      const q = input.value.trim().toLowerCase();
      if (!q || !items.length) return;
      const matches = items.filter(item => (item.name || '').toLowerCase().includes(q));
      if (!matches.length) return;

      dropdown = document.createElement('div');
      dropdown.className = 'autocomplete-dropdown';
      input.parentNode.style.position = 'relative';
      input.parentNode.appendChild(dropdown);

      matches.slice(0, 10).forEach(item => {
        const opt = document.createElement('div');
        opt.className = 'ac-option';
        opt.innerHTML = displayFn(item);
        opt.addEventListener('click', () => {
          input.value = item.name || item.description || '';
          onSelect(item);
          closeDropdown();
          input.focus();
        });
        dropdown.appendChild(opt);
      });
    });

    input.addEventListener('blur', () => setTimeout(closeDropdown, 200));
    input.addEventListener('focus', () => { if (input.value.trim()) input.dispatchEvent(new Event('input')); });
  }

  function makeProcedureRow(data) {
    const div = document.createElement('div');
    div.className = 'row-item procedure-row';
    div.innerHTML = `
      <div style="display:grid;grid-template-columns:2fr 1fr 1fr 1fr auto;gap:8px;align-items:start">
        <div class="form-group" style="margin:0">
          <input type="text" class="form-input proc-name" placeholder="Nombre del procedimiento" value="${escapeHtml(data?.name || '')}" autocomplete="off">
          <input type="hidden" class="proc-priceItem" value="${data?.priceItemId || ''}">
        </div>
        <div class="form-group" style="margin:0">
          <input type="number" class="form-input proc-customPrice" placeholder="Precio $" step="0.01" value="${data?.customPrice || ''}">
        </div>
        <div class="form-group" style="margin:0">
          <input type="number" class="form-input proc-quantity" placeholder="Cant." min="1" value="${data?.quantity || 1}">
        </div>
        <div class="form-group" style="margin:0">
          <input type="text" class="form-input proc-supply" placeholder="Insumo (opcional)" value="${data?.supplyName || ''}" autocomplete="off">
        </div>
        <button type="button" class="btn btn-danger btn-sm proc-remove-btn" style="padding:4px 8px">X</button>
      </div>
    `;

    const nameInput = div.querySelector('.proc-name');
    const priceItemInput = div.querySelector('.proc-priceItem');
    const priceInput = div.querySelector('.proc-customPrice');
    const qtyInput = div.querySelector('.proc-quantity');
    const supplyInput = div.querySelector('.proc-supply');

    nameInput.addEventListener('input', () => {
      priceItemInput.value = '';
    });

    setupAutocomplete(nameInput, priceItemsCache, item =>
      `<span>${escapeHtml(item.name)}</span><span>${formatCurrency(item.price || 0)}</span>`,
      item => {
        priceItemInput.value = item.id;
        if (!priceInput.value || parseFloat(priceInput.value) === 0) {
          priceInput.value = item.price || '';
        }
        recalcRecordTotal();
      }
    );

    supplyInput.addEventListener('input', () => {
      supplyInput.dataset.supplyId = '';
    });

    setupAutocomplete(supplyInput, suppliesCache, item =>
      `<span>${escapeHtml(item.name)}</span><span>${formatCurrency(item.unitPrice || 0)} (stock: ${item.currentStock ?? '-'})</span>`,
      item => {
        supplyInput.dataset.supplyId = item.id;
        recalcRecordTotal();
      }
    );

    [priceInput, qtyInput].forEach(el =>
      el.addEventListener('input', recalcRecordTotal)
    );

    div.querySelector('.proc-remove-btn').addEventListener('click', () => {
      div.remove();
      recalcRecordTotal();
    });

    return div;
  }

  document.getElementById('add-procedure-btn')?.addEventListener('click', () => {
    const container = document.getElementById('procedures-container');
    if (container) container.appendChild(makeProcedureRow(null));
  });

  function makeSupplyItemRow(data) {
    const div = document.createElement('div');
    div.className = 'row-item supply-item-row';
    div.dataset.supplyId = data?.supplyId || '';
    div.innerHTML = `
      <div style="display:grid;grid-template-columns:2fr 1fr 1fr auto;gap:8px;align-items:start">
        <div class="form-group" style="margin:0">
          <input type="text" class="form-input si-desc" placeholder="Insumo" value="${escapeHtml(data?.description || '')}" autocomplete="off">
        </div>
        <div class="form-group" style="margin:0">
          <input type="number" class="form-input si-qty" placeholder="Cant." min="1" value="${data?.quantity || 1}">
        </div>
        <div class="form-group" style="margin:0">
          <input type="number" class="form-input si-price" placeholder="Precio $/u" step="0.01" value="${data?.unitPrice || ''}">
        </div>
        <button type="button" class="btn btn-danger btn-sm si-remove-btn" style="padding:4px 8px">X</button>
      </div>
    `;

    const descInput = div.querySelector('.si-desc');
    const qtyInput = div.querySelector('.si-qty');
    const priceInput = div.querySelector('.si-price');

    descInput.addEventListener('input', () => {
      div.dataset.supplyId = '';
    });

    setupAutocomplete(descInput, suppliesCache, item =>
      `<span>${escapeHtml(item.name)}</span><span>${formatCurrency(item.unitPrice || 0)} (stock: ${item.currentStock ?? '-'})</span>`,
      item => {
        descInput.value = item.name;
        div.dataset.supplyId = item.id;
        if (!priceInput.value || parseFloat(priceInput.value) === 0) {
          priceInput.value = item.unitPrice || '';
        }
        recalcRecordTotal();
      }
    );

    [qtyInput, priceInput].forEach(el =>
      el.addEventListener('input', recalcRecordTotal)
    );

    div.querySelector('.si-remove-btn').addEventListener('click', () => {
      div.remove();
      recalcRecordTotal();
    });

    return div;
  }

  document.getElementById('add-supply-item-btn')?.addEventListener('click', () => {
    const container = document.getElementById('supply-items-container');
    if (container) container.appendChild(makeSupplyItemRow(null));
  });

  function makePrescriptionSupplyRow(existing) {
    const div = document.createElement('div');
    div.className = 'row-item prescription-supply-row';
    div.dataset.supplyId = existing?.supplyId || '';

    const unitPrice = existing?.unitPrice || 0;
    const dispensingQty = existing?.dispensingQuantity || 1;
    const total = unitPrice * dispensingQty;

    div.innerHTML = `
      <div style="display:flex;flex-direction:column;gap:8px">
        <div style="display:grid;grid-template-columns:2fr 1fr auto;gap:8px;align-items:end">
          <div class="form-group" style="margin:0">
            <label class="form-label">Insumo</label>
            <input type="text" class="form-input ps-supply-search" placeholder="Buscar insumo..." value="${escapeHtml(existing?.supplyName || '')}" autocomplete="off">
          </div>
          <div class="form-group" style="margin:0">
            <label class="form-label">Cant. a dispensar</label>
            <div style="display:flex;align-items:center;gap:4px">
              <input type="number" class="form-input ps-disp-qty" min="1" step="1" value="${dispensingQty}" style="width:80px">
              <span class="ps-dispensing-unit-label" style="font-size:var(--text-sm);color:var(--text-secondary)">${escapeHtml(existing?.dispensingUnit || 'u.')}</span>
            </div>
          </div>
          <button type="button" class="btn btn-danger btn-sm ps-remove-btn" style="padding:4px 8px;height:fit-content">X</button>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;align-items:center">
          <div class="form-group" style="margin:0">
            <label class="form-label">Precio $/u (auto)</label>
            <input type="number" class="form-input ps-unit-price" step="0.01" value="${unitPrice}" readonly style="background:var(--bg)">
          </div>
          <div class="form-group" style="margin:0">
            <label class="form-label">Total</label>
            <input type="text" class="form-input ps-row-total" value="${formatCurrency(total)}" readonly style="background:var(--bg);font-weight:600">
          </div>
          <div class="ps-unit-info" style="font-size:var(--text-xs);color:var(--text-secondary);display:${existing?.supplyId ? 'block' : 'none'}">
            Stock: <span class="ps-stock-unit"></span> &middot;
            1 <span class="ps-stock-unit"></span> = <span class="ps-units-per-stock"></span> <span class="ps-dispensing-unit"></span>
          </div>
        </div>
      </div>
    `;

    const searchInput = div.querySelector('.ps-supply-search');
    const qtyInput = div.querySelector('.ps-disp-qty');
    const priceInput = div.querySelector('.ps-unit-price');
    const totalEl = div.querySelector('.ps-row-total');
    const unitInfo = div.querySelector('.ps-unit-info');
    const unitLabel = div.querySelector('.ps-dispensing-unit-label');

    searchInput.addEventListener('input', () => {
      const prevId = toId(div.dataset.supplyId);
      if (prevId) {
        prescriptionSupplies = prescriptionSupplies.filter(s => s.supplyId !== prevId);
      }
      div.dataset.supplyId = '';
    });

    setupAutocomplete(searchInput, suppliesCache, item =>
      `<span>${escapeHtml(item.name)}</span><span>${formatCurrency(item.salePrice || item.unitPrice || 0)} (stock: ${item.quantity ?? '-'})</span>`,
      item => {
        searchInput.value = item.name;
        div.dataset.supplyId = item.id;

        const stockUnit = item.stockUnit || item.unit || 'unidad';
        const upStock = item.unitsPerStock || 1;
        const dispUnit = item.dispensingUnit || 'u.';
        const salePrice = item.salePrice || 0;
        const calcUnitPrice = upStock > 0 && salePrice > 0 ? salePrice / upStock : item.unitPrice || 0;

        unitInfo.querySelector('.ps-stock-unit').textContent = stockUnit;
        unitInfo.querySelector('.ps-units-per-stock').textContent = upStock;
        unitInfo.querySelector('.ps-dispensing-unit').textContent = dispUnit;
        unitInfo.style.display = 'block';
        unitLabel.textContent = dispUnit;

        priceInput.value = calcUnitPrice.toFixed(2);
        qtyInput.value = 1;

        const rowTotal = calcUnitPrice;
        totalEl.value = formatCurrency(rowTotal);

        const idx = prescriptionSupplies.findIndex(s => s.supplyId === item.id);
        const entry = { supplyId: item.id, supplyName: item.name, dispensingQuantity: 1, dispensingUnit: dispUnit, unitPrice: calcUnitPrice };
        if (idx >= 0) prescriptionSupplies[idx] = entry;
        else prescriptionSupplies.push(entry);

        recalcRecordTotal();
      }
    );

    const updateRow = () => {
      const qty = parseInt(qtyInput.value) || 1;
      const price = parseFloat(priceInput.value) || 0;
      totalEl.value = formatCurrency(qty * price);

      const idx = prescriptionSupplies.findIndex(s => s.supplyId === toId(div.dataset.supplyId));
      if (idx >= 0) {
        prescriptionSupplies[idx].dispensingQuantity = qty;
        recalcRecordTotal();
      }
    };

    qtyInput.addEventListener('input', updateRow);

    div.querySelector('.ps-remove-btn').addEventListener('click', () => {
      prescriptionSupplies = prescriptionSupplies.filter(s => s.supplyId !== toId(div.dataset.supplyId));
      div.remove();
      recalcRecordTotal();
    });

    return div;
  }

  // Toggle modo completo
  document.getElementById('prescription-complete-mode')?.addEventListener('change', (e) => {
    const show = e.target.checked;
    document.getElementById('prescription-supplies').style.display = show ? 'block' : 'none';
  });

  // Botón agregar insumo en modo completo
  document.getElementById('add-prescription-supply-btn')?.addEventListener('click', () => {
    const container = document.getElementById('prescription-supplies-list');
    if (container) container.appendChild(makePrescriptionSupplyRow(null));
  });

  // === PAYMENT METHOD HANDLER ===
  document.getElementById('record-payment-method')?.addEventListener('change', () => {
    const method = document.getElementById('record-payment-method').value;
    const indicator = document.getElementById('cash-indicator');
    if (indicator) {
      if (method === 'CASH') {
        indicator.textContent = '💰 Genera movimiento de caja';
        indicator.className = 'cash-indicator active';
      } else {
        indicator.textContent = 'No genera movimiento de caja';
        indicator.className = 'cash-indicator inactive';
      }
    }
  });
}

export function recalcRecordTotal() {
  let total = 0;

  document.querySelectorAll('.procedure-row').forEach(row => {
    const price = parseFloat(row.querySelector('.proc-customPrice')?.value) || 0;
    const qty = parseInt(row.querySelector('.proc-quantity')?.value) || 1;
    total += price * qty;
  });

  document.querySelectorAll('.supply-item-row').forEach(row => {
    const price = parseFloat(row.querySelector('.si-price')?.value) || 0;
    const qty = parseInt(row.querySelector('.si-qty')?.value) || 1;
    total += price * qty;
  });

  document.querySelectorAll('.prescription-supply-row').forEach(row => {
    const price = parseFloat(row.querySelector('.ps-unit-price')?.value) || 0;
    const qty = parseInt(row.querySelector('.ps-disp-qty')?.value) || 1;
    total += price * qty;
  });

  const el = document.getElementById('record-payment-total');
  if (el) el.value = formatCurrency(total);
}
