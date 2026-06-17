import { api } from '../../services/api.js';
import { escapeHtml } from '../../utils/escape.js';
import { formatSpecies, formatGender } from '../../utils/formatters.js';
import { createSearchBar } from '../../components/SearchBar.js';
import { VirtualScroll } from '../../utils/virtualScroll.js';
import Modal, { openModal } from '../../components/Modal.js';
import { showToast } from '../../components/Toast.js';
import { showFieldError, clearFieldErrors } from '../../utils/validators.js';

let petsController = null;
let petsVS = null;

export async function loadPetsData(pageData, page = 1, search = '') {
  if (petsController) petsController.abort();
  petsController = new AbortController();
  try {
    const params = { page, limit: 20 };
    if (search) params.search = search;
    
    const result = await api.get('/pets', params, { signal: petsController.signal });
    pageData.pets = { ...result, page, search };
  } catch (e) {
    if (e.name === 'AbortError') return;
    pageData.pets = { data: [], meta: { total: 0 }, page, search };
  }
}

export async function renderPetsPage(content, pageData) {
  const data = pageData.pets || { data: [], meta: { total: 0 } };
  
  content.replaceChildren();
  content.insertAdjacentHTML('beforeend', `
    <div class="page-header">
      <div id="search-pets"></div>
      <button class="btn btn-primary" id="add-pet-btn">Nueva Mascota</button>
    </div>
    <div id="pets-list"></div>
    <div id="pets-pagination"></div>
  `);
  
  const searchBar = createSearchBar({
    placeholder: 'Buscar mascotas...',
    initialValue: data.search || '',
    onSearch: async (query) => {
      pageData.pets.search = query;
      await loadPetsData(pageData, 1, query);
      renderPetsPage(document.getElementById('page-content'), pageData);
    }
  });
  document.getElementById('search-pets').appendChild(searchBar);
  
  const listEl = document.getElementById('pets-list');
  if (data.data?.length) {
    listEl.replaceChildren();
    listEl.insertAdjacentHTML('beforeend', `
      <table class="data-table">
        <thead><tr><th>Nombre</th><th>Especie</th><th>Raza</th><th>Dueño</th><th>Acciones</th></tr></thead>
        <tbody>${data.data.map(p => `
          <tr>
            <td>${escapeHtml(p.name)}</td>
            <td>${formatSpecies(p.species)}</td>
            <td>${escapeHtml(p.breed || '-')}</td>
            <td>${p.client?.name ? escapeHtml(p.client?.name) : '<span style="color:var(--text-secondary)">Sin dueño</span>'}</td>
            <td>
              <button class="btn btn-outline btn-sm" data-id="${escapeHtml(p.id)}" data-action="view-pet">Ver</button>
              <button class="btn btn-outline btn-sm" data-id="${escapeHtml(p.id)}" data-action="edit-pet">Editar</button>
              <button class="btn btn-danger btn-sm" data-id="${escapeHtml(p.id)}" data-action="delete-pet">Eliminar</button>
            </td>
          </tr>
        `).join('')}</tbody>
      </table>
    `);
    
    listEl.querySelectorAll('[data-action="view-pet"]').forEach(btn => {
      btn.addEventListener('click', () => showPetDetail(btn.dataset.id, pageData));
    });
    listEl.querySelectorAll('[data-action="edit-pet"]').forEach(btn => {
      btn.addEventListener('click', () => showPetModal(btn.dataset.id, pageData));
    });
    listEl.querySelectorAll('[data-action="delete-pet"]').forEach(btn => {
      btn.addEventListener('click', () => deletePet(btn.dataset.id, pageData));
    });
  } else {
    listEl.replaceChildren();
    listEl.insertAdjacentHTML('beforeend', '<div class="empty-state" role="status"><p>No hay mascotas</p></div>');
  }
  
  if (petsVS) petsVS.destroy();
  if (data.meta?.totalPages > 1) {
    const tbody = document.querySelector('#pets-list tbody');
    const table = document.querySelector('#pets-list table');
    petsVS = new VirtualScroll({
      container: table || listEl,
      tableHeadHtml: '<tr><th>Nombre</th><th>Especie</th><th>Raza</th><th>Dueño</th><th>Acciones</th></tr>',
      getTbody: () => tbody,
      pageSize: 20,
      fetchPage: async (page) => {
        const result = await api.get('/pets', { page, limit: 20, search: pageData.pets?.search || '' });
        return result;
      },
      renderRow: (p) => `
        <tr>
          <td>${escapeHtml(p.name)}</td>
          <td>${formatSpecies(p.species)}</td>
          <td>${escapeHtml(p.breed || '-')}</td>
          <td>${p.client?.name ? escapeHtml(p.client?.name) : '<span style="color:var(--text-secondary)">Sin dueño</span>'}</td>
          <td>
            <button class="btn btn-outline btn-sm" data-id="${escapeHtml(p.id)}" data-action="view-pet">Ver</button>
            <button class="btn btn-outline btn-sm" data-id="${escapeHtml(p.id)}" data-action="edit-pet">Editar</button>
            <button class="btn btn-danger btn-sm" data-id="${escapeHtml(p.id)}" data-action="delete-pet">Eliminar</button>
          </td>
        </tr>`,
      afterRender: (all) => {
        pageData.pets = { ...pageData.pets, data: all };
        const container = document.querySelector('#pets-list table') || listEl;
        container.querySelectorAll('[data-action="view-pet"]').forEach(btn => {
          btn.addEventListener('click', () => showPetDetail(btn.dataset.id, pageData));
        });
        container.querySelectorAll('[data-action="edit-pet"]').forEach(btn => {
          btn.addEventListener('click', () => showPetModal(btn.dataset.id, pageData));
        });
        container.querySelectorAll('[data-action="delete-pet"]').forEach(btn => {
          btn.addEventListener('click', () => deletePet(btn.dataset.id, pageData));
        });
      }
    });
    petsVS.init(2);
  }
  
  document.getElementById('add-pet-btn')?.addEventListener('click', () => showAddPetModal(pageData));
}

function showPetDetail(petId, pageData) {
  const pet = pageData.pets?.data?.find(p => p.id === petId);
  if (!pet) return;

  function refreshPhotos() {
    api.get(`/pets/${petId}`).then(fullPet => {
      const photosEl = document.getElementById('pet-photos-list');
      if (!photosEl) return;

      const photos = fullPet.photos || [];
      if (photos.length) {
        photosEl.replaceChildren();
        photosEl.insertAdjacentHTML('beforeend', `
          <div style="display:flex;gap:8px;flex-wrap:wrap">
            ${photos.map(ph => `
              <div style="position:relative;width:80px;height:80px">
                <img src="${escapeHtml(ph.cloudinaryUrl)}" style="width:100%;height:100%;object-fit:cover;border-radius:var(--radius);cursor:pointer" onclick="window.showImageView && window.showImageView('${escapeHtml(ph.cloudinaryUrl)}')">
                <button class="btn btn-danger btn-sm" style="position:absolute;top:2px;right:2px;padding:2px 6px;font-size:10px" data-photo-id="${escapeHtml(ph.id)}" data-pet-id="${escapeHtml(petId)}" data-action="delete-photo">X</button>
              </div>
            `).join('')}
          </div>
        `);
        photosEl.querySelectorAll('[data-action="delete-photo"]').forEach(btn => {
          btn.addEventListener('click', async () => {
            if (!(await Modal.confirm('¿Eliminar esta foto?'))) return;
            try {
              await api.delete(`/pets/${petId}/photos/${btn.dataset.photoId}`);
              showToast('Foto eliminada', 'success');
              refreshPhotos();
            } catch (e) {
              showToast(e.message || 'Error', 'error');
            }
          });
        });
      } else {
        photosEl.replaceChildren();
        photosEl.insertAdjacentHTML('beforeend',
          '<div style="color:var(--text-secondary);font-size:var(--text-sm)">No hay fotos</div>'
        );
      }
    }).catch(() => {
      const photosEl = document.getElementById('pet-photos-list');
      if (photosEl) {
        photosEl.replaceChildren();
        photosEl.insertAdjacentHTML('beforeend',
          '<div style="color:var(--text-secondary);font-size:var(--text-sm)">Error cargando fotos</div>'
        );
      }
    });
  }

  openModal({
    title: `Mascota: ${escapeHtml(pet.name)}`,
    size: 'lg',
    content: `
      <div class="detail-row"><span>Nombre:</span><span>${escapeHtml(pet.name)}</span></div>
      <div class="detail-row"><span>Especie:</span><span>${formatSpecies(pet.species)}</span></div>
      <div class="detail-row"><span>Raza:</span><span>${escapeHtml(pet.breed || '-')}</span></div>
      <div class="detail-row"><span>Género:</span><span>${pet.gender ? formatGender(pet.gender) : '-'}</span></div>
      <div class="detail-row"><span>Peso:</span><span>${pet.weight ? pet.weight + ' kg' : '-'}</span></div>
      <div class="detail-row"><span>Color:</span><span>${escapeHtml(pet.color || '-')}</span></div>
      <div class="detail-row"><span>Dueño:</span><span>${pet.client?.name ? escapeHtml(pet.client?.name) : 'Sin dueño'}</span></div>
      <hr style="margin:16px 0">
      <h4 style="margin-bottom:8px">Fotos</h4>
      <div id="pet-photos-list">Cargando...</div>
      <div style="margin-top:8px">
        <input type="file" id="pet-photo-input" accept="image/*" style="display:none">
        <button class="btn btn-outline btn-sm" id="upload-pet-photo-btn">+ Subir foto</button>
        <span style="font-size:var(--text-xs);color:var(--text-secondary);margin-left:8px">Máximo 5 fotos</span>
      </div>
    `,
    showCancel: false,
    confirmText: 'Cerrar',
  });

  refreshPhotos();

  document.getElementById('upload-pet-photo-btn')?.addEventListener('click', () => {
    document.getElementById('pet-photo-input')?.click();
  });

  document.getElementById('pet-photo-input')?.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      showToast('Subiendo foto...', 'info');
      const formData = new FormData();
      formData.append('file', file);
      await api.postForm(`/pets/${petId}/photos`, formData);
      showToast('Foto subida', 'success');
      refreshPhotos();
    } catch (err) {
      showToast(err.message || 'Error subiendo foto', 'error');
    }
    e.target.value = '';
  });
}

export async function deletePet(petId, pageData) {
  const confirmed = await Modal.confirm('¿Estás seguro de eliminar esta mascota?');
  if (!confirmed) return;
  try {
    await api.delete(`/pets/${petId}`);
    showToast('Mascota eliminada', 'success');
    await loadPetsData(pageData, pageData.pets?.page || 1, pageData.pets?.search || '');
    renderPetsPage(document.getElementById('page-content'), pageData);
  } catch (e) {
    showToast(e.message || 'Error eliminando mascota', 'error');
  }
}

export function showAddPetModal(pageData) {
  showPetModal(null, pageData);
}

export function showPetModal(petId, pageData) {
  const isEdit = !!petId;
  const pet = isEdit ? pageData.pets?.data?.find(p => p.id === petId) : null;
  let clientsCache = [];

  function renderClientOptions(clientes, selectedId) {
    const sel = document.getElementById('pet-clientId');
    if (!sel) return;
    sel.replaceChildren();
    sel.insertAdjacentHTML('beforeend',
      `<option value="">Sin dueño (mascota callejera)</option>` +
      clientes.map(c =>
        `<option value="${escapeHtml(c.id)}" ${c.id === selectedId ? 'selected' : ''}>` +
        `${escapeHtml(c.name)} ${escapeHtml(c.lastName || '')}</option>`
      ).join('')
    );
    // NO tocar sel.size — el select siempre es dropdown estándar
  }

  api.get('/clients', { limit: 50 }).then(r => {
    clientsCache = r.data || [];
    renderClientOptions(clientsCache, pet?.clientId);
    const busqueda = document.getElementById('pet-client-search');
    if (busqueda) {
      busqueda.addEventListener('input', () => {
        const q = busqueda.value.trim().toLowerCase();
        const filtrados = q
          ? clientsCache.filter(c =>
              `${c.name} ${c.lastName || ''}`.toLowerCase().includes(q))
          : clientsCache;
        renderClientOptions(filtrados, document.getElementById('pet-clientId')?.value);
      });
    }
  }).catch(() => {});

  openModal({
    title: isEdit ? `Editar: ${escapeHtml(pet?.name || 'Mascota')}` : 'Nueva Mascota',
    content: `
      <form id="pet-form">
        <div class="form-group">
          <label class="form-label">Dueño</label>
          <input
            type="text"
            class="form-input"
            id="pet-client-search"
            placeholder="Buscar cliente por nombre..."
            autocomplete="off"
            style="margin-bottom:6px"
          >
          <select class="form-input" id="pet-clientId">
            <option value="">Sin dueño (mascota callejera)</option>
          </select>
        </div>
        <div class="form-row" style="display:flex;gap:12px">
          <div class="form-group" style="flex:1">
            <label class="form-label required">Nombre</label>
            <input type="text" class="form-input" id="pet-name" value="${escapeHtml(pet?.name || '')}">
          </div>
          <div class="form-group" style="flex:1">
            <label class="form-label required">Especie</label>
            <select class="form-input" id="pet-species">
              <option value="">Seleccionar...</option>
              <option value="DOG" ${pet?.species === 'DOG' ? 'selected' : ''}>Perro</option>
              <option value="CAT" ${pet?.species === 'CAT' ? 'selected' : ''}>Gato</option>
              <option value="HORSE" ${pet?.species === 'HORSE' ? 'selected' : ''}>Caballo</option>
              <option value="BIRD" ${pet?.species === 'BIRD' ? 'selected' : ''}>Ave</option>
              <option value="RABBIT" ${pet?.species === 'RABBIT' ? 'selected' : ''}>Conejo</option>
              <option value="REPTILE" ${pet?.species === 'REPTILE' ? 'selected' : ''}>Reptil</option>
              <option value="OTHER" ${pet?.species === 'OTHER' ? 'selected' : ''}>Otro</option>
            </select>
          </div>
        </div>
        <div class="form-row" style="display:flex;gap:12px">
          <div class="form-group" style="flex:1">
            <label class="form-label">Raza</label>
            <input type="text" class="form-input" id="pet-breed" value="${escapeHtml(pet?.breed || '')}">
          </div>
          <div class="form-group" style="flex:1">
            <label class="form-label">Género</label>
            <select class="form-input" id="pet-gender">
              <option value="">Seleccionar...</option>
              <option value="MALE" ${pet?.gender === 'MALE' ? 'selected' : ''}>Macho</option>
              <option value="FEMALE" ${pet?.gender === 'FEMALE' ? 'selected' : ''}>Hembra</option>
            </select>
          </div>
        </div>
        <div class="form-row" style="display:flex;gap:12px">
          <div class="form-group" style="flex:1">
            <label class="form-label">Fecha de Nacimiento</label>
            <input type="date" class="form-input" id="pet-birthDate" value="${pet?.birthDate ? escapeHtml(pet.birthDate.split('T')[0]) : ''}">
          </div>
          <div class="form-group" style="flex:1">
            <label class="form-label">Peso (kg)</label>
            <input type="number" step="0.01" class="form-input" id="pet-weight" value="${escapeHtml(pet?.weight || '')}">
          </div>
          <div class="form-group" style="flex:1">
            <label class="form-label">Color</label>
            <input type="text" class="form-input" id="pet-color" value="${escapeHtml(pet?.color || '')}">
          </div>
        </div>
        <div class="form-row" style="display:flex;gap:12px">
          <div class="form-group" style="flex:1">
            <label class="form-label">Microchip</label>
            <input type="text" class="form-input" id="pet-microchip" value="${escapeHtml(pet?.microchipId || '')}">
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">Notas</label>
          <textarea class="form-input" id="pet-notes" rows="2">${escapeHtml(pet?.notes || '')}</textarea>
        </div>
      </form>
    `,
    confirmText: isEdit ? 'Guardar' : 'Crear',
    onConfirm: async () => {
      clearFieldErrors('pet-form');
      const name = document.getElementById('pet-name').value.trim();
      const species = document.getElementById('pet-species').value;
      
      if (!name) showFieldError('pet-name', 'El nombre es requerido');
      if (!species) showFieldError('pet-species', 'La especie es requerida');
      if (!name || !species) return false;
      
      try {
        const payload = {
          name,
          species,
          clientId: document.getElementById('pet-clientId').value || undefined,
          breed: document.getElementById('pet-breed').value.trim(),
          gender: document.getElementById('pet-gender').value,
          birthDate: document.getElementById('pet-birthDate').value || undefined,
          weight: parseFloat(document.getElementById('pet-weight').value) || undefined,
          color: document.getElementById('pet-color').value.trim(),
          microchipId: document.getElementById('pet-microchip').value.trim(),
          notes: document.getElementById('pet-notes').value.trim(),
        };
        
        if (isEdit) {
          await api.patch(`/pets/${petId}`, payload);
          showToast('Mascota actualizada', 'success');
        } else {
          await api.post('/pets', payload);
          showToast('Mascota creada', 'success');
        }
        
        await loadPetsData(pageData, pageData.pets?.page || 1, pageData.pets?.search || '');
        renderPetsPage(document.getElementById('page-content'), pageData);
      } catch (e) {
        showToast(e.message || 'Error guardando mascota', 'error');
        return false;
      }
    }
  });
}
