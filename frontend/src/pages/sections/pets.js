import { api } from '../../services/api.js';
import { formatSpecies, formatGender } from '../../utils/formatters.js';
import { createSearchBar } from '../../components/SearchBar.js';
import { createPagination } from '../../components/Pagination.js';
import { openModal } from '../../components/Modal.js';
import { showToast } from '../../components/Toast.js';

export async function loadPetsData(pageData, page = 1, search = '') {
  try {
    const params = { page, limit: 20 };
    if (search) params.search = search;
    
    const result = await api.get('/pets', params);
    pageData.pets = { ...result, page, search };
  } catch (e) {
    pageData.pets = { data: [], meta: { total: 0 }, page, search };
  }
}

export async function renderPetsPage(content, pageData) {
  const data = pageData.pets || { data: [], meta: { total: 0 } };
  
  content.innerHTML = `
    <div class="page-header">
      <div id="search-pets"></div>
      <button class="btn btn-primary" id="add-pet-btn">Nueva Mascota</button>
    </div>
    <div id="pets-list"></div>
    <div id="pets-pagination"></div>
  `;
  
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
    listEl.innerHTML = `
      <table class="data-table">
        <thead><tr><th>Nombre</th><th>Especie</th><th>Raza</th><th>Dueño</th><th>Acciones</th></tr></thead>
        <tbody>${data.data.map(p => `
          <tr>
            <td>${p.name}</td>
            <td>${formatSpecies(p.species)}</td>
            <td>${p.breed || '-'}</td>
            <td>${p.client?.name || '<span style="color:var(--text-secondary)">Sin dueño</span>'}</td>
            <td>
              <button class="btn btn-outline btn-sm" data-id="${p.id}" data-action="view-pet">Ver</button>
              <button class="btn btn-outline btn-sm" data-id="${p.id}" data-action="edit-pet">Editar</button>
              <button class="btn btn-danger btn-sm" data-id="${p.id}" data-action="delete-pet">Eliminar</button>
            </td>
          </tr>
        `).join('')}</tbody>
      </table>
    `;
    
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
    listEl.innerHTML = '<div class="empty-state"><p>No hay mascotas</p></div>';
  }
  
  const paginationEl = document.getElementById('pets-pagination');
  if (data.meta?.totalPages > 1) {
    const pagination = createPagination({
      total: data.meta.total,
      page: data.page || 1,
      limit: 20,
      onPageChange: async (newPage) => {
        await loadPetsData(pageData, newPage, pageData.pets?.search || '');
        renderPetsPage(document.getElementById('page-content'), pageData);
      }
    });
    paginationEl.appendChild(pagination);
  }
  
  document.getElementById('add-pet-btn')?.addEventListener('click', () => showAddPetModal(pageData));
}

function showPetDetail(petId, pageData) {
  const pet = pageData.pets?.data?.find(p => p.id === petId);
  if (!pet) return;
  
  openModal({
    title: `Mascota: ${pet.name}`,
    size: 'lg',
    content: `
      <div class="detail-row"><span>Nombre:</span><span>${pet.name}</span></div>
      <div class="detail-row"><span>Especie:</span><span>${formatSpecies(pet.species)}</span></div>
      <div class="detail-row"><span>Raza:</span><span>${pet.breed || '-'}</span></div>
      <div class="detail-row"><span>Género:</span><span>${pet.gender ? formatGender(pet.gender) : '-'}</span></div>
      <div class="detail-row"><span>Peso:</span><span>${pet.weight ? pet.weight + ' kg' : '-'}</span></div>
      <div class="detail-row"><span>Color:</span><span>${pet.color || '-'}</span></div>
      <div class="detail-row"><span>Dueño:</span><span>${pet.client?.name || 'Sin dueño'}</span></div>
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
  
  api.get(`/pets/${petId}`).then(fullPet => {
    const photosEl = document.getElementById('pet-photos-list');
    if (!photosEl) return;
    
    const photos = fullPet.photos || [];
    if (photos.length) {
      photosEl.innerHTML = `
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          ${photos.map(ph => `
            <div style="position:relative;width:80px;height:80px">
              <img src="${ph.cloudinaryUrl}" style="width:100%;height:100%;object-fit:cover;border-radius:var(--radius);cursor:pointer" onclick="window.showImageView && window.showImageView('${ph.cloudinaryUrl}')">
              <button class="btn btn-danger btn-sm" style="position:absolute;top:2px;right:2px;padding:2px 6px;font-size:10px" data-photo-id="${ph.id}" data-pet-id="${petId}" data-action="delete-photo">X</button>
            </div>
          `).join('')}
        </div>
      `;
      photosEl.querySelectorAll('[data-action="delete-photo"]').forEach(btn => {
        btn.addEventListener('click', async () => {
          if (!window.confirm('¿Eliminar esta foto?')) return;
          try {
            await api.delete(`/pets/${petId}/photos/${btn.dataset.photoId}`);
            showToast('Foto eliminada', 'success');
            showPetDetail(petId, pageData);
          } catch (e) {
            showToast(e.message || 'Error', 'error');
          }
        });
      });
    } else {
      photosEl.innerHTML = '<div style="color:var(--text-secondary);font-size:var(--text-sm)">No hay fotos</div>';
    }
  }).catch(() => {
    const photosEl = document.getElementById('pet-photos-list');
    if (photosEl) photosEl.innerHTML = '<div style="color:var(--text-secondary);font-size:var(--text-sm)">Error cargando fotos</div>';
  });
  
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
      showPetDetail(petId, pageData);
    } catch (err) {
      showToast(err.message || 'Error subiendo foto', 'error');
    }
    e.target.value = '';
  });
}

export async function deletePet(petId, pageData) {
  if (!window.confirm('¿Estás seguro de eliminar esta mascota?')) return;
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
  
  api.get('/clients?limit=200').then(r => {
    clientsCache = r.data || [];
    const sel = document.getElementById('pet-clientId');
    if (sel) {
      sel.innerHTML = '<option value="">Sin dueño (mascota callejera)</option>' +
        clientsCache.map(c => `<option value="${c.id}" ${c.id === pet?.clientId ? 'selected' : ''}>${c.name} ${c.lastName || ''}</option>`).join('');
    }
  }).catch(() => {});
  
  openModal({
    title: isEdit ? `Editar: ${pet?.name || 'Mascota'}` : 'Nueva Mascota',
    content: `
      <form id="pet-form">
        <div class="form-group">
          <label class="form-label">Dueño</label>
          <select class="form-input" id="pet-clientId">
            <option value="">Sin dueño (mascota callejera)</option>
          </select>
        </div>
        <div class="form-row" style="display:flex;gap:12px">
          <div class="form-group" style="flex:1">
            <label class="form-label required">Nombre</label>
            <input type="text" class="form-input" id="pet-name" value="${pet?.name || ''}">
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
            <input type="text" class="form-input" id="pet-breed" value="${pet?.breed || ''}">
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
            <input type="date" class="form-input" id="pet-birthDate" value="${pet?.birthDate ? pet.birthDate.split('T')[0] : ''}">
          </div>
          <div class="form-group" style="flex:1">
            <label class="form-label">Peso (kg)</label>
            <input type="number" step="0.01" class="form-input" id="pet-weight" value="${pet?.weight || ''}">
          </div>
          <div class="form-group" style="flex:1">
            <label class="form-label">Color</label>
            <input type="text" class="form-input" id="pet-color" value="${pet?.color || ''}">
          </div>
        </div>
        <div class="form-row" style="display:flex;gap:12px">
          <div class="form-group" style="flex:1">
            <label class="form-label">Microchip</label>
            <input type="text" class="form-input" id="pet-microchip" value="${pet?.microchipId || ''}">
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">Notas</label>
          <textarea class="form-input" id="pet-notes" rows="2">${pet?.notes || ''}</textarea>
        </div>
      </form>
    `,
    confirmText: isEdit ? 'Guardar' : 'Crear',
    onConfirm: async () => {
      const name = document.getElementById('pet-name').value.trim();
      const species = document.getElementById('pet-species').value;
      
      if (!name || !species) {
        showToast('Nombre y especie son requeridos', 'error');
        return false;
      }
      
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
