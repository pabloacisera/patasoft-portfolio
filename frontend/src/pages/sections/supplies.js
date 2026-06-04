import { api } from '../../services/api.js';
import { formatCurrency } from '../../utils/formatters.js';
import { showFieldError } from '../../utils/validators.js';
import { createSearchBar } from '../../components/SearchBar.js';
import { createPagination } from '../../components/Pagination.js';
import { openModal } from '../../components/Modal.js';
import { showToast } from '../../components/Toast.js';

export async function loadSuppliesData(pageData, page = 1, search = '') {
  try {
    const params = { page, limit: 20 };
    if (search) params.search = search;
    
    const result = await api.get('/supplies', params);
    pageData.supplies = { ...result, page, search };
  } catch (e) {
    pageData.supplies = { data: [], meta: { total: 0 }, page, search };
  }
}

export async function renderSuppliesPage(content, pageData) {
  const data = pageData.supplies || { data: [], meta: { total: 0 } };
  
  content.innerHTML = `
    <div class="page-header">
      <div id="search-supplies"></div>
      <div style="display: flex; gap: 8px; flex-wrap: wrap;">
        <button class="btn btn-outline" id="download-template-btn">📥 Plantilla Excel</button>
        <button class="btn btn-outline" id="export-supplies-btn">📤 Exportar Excel</button>
        <button class="btn btn-outline" id="import-supplies-btn">
          📂 Importar Excel
          <input type="file" id="import-supplies-input" accept=".xlsx,.xls" style="display: none;">
        </button>
        <button class="btn btn-primary" id="add-supply-btn">Nuevo Insumo</button>
      </div>
    </div>
    <div id="supplies-list"></div>
    <div id="supplies-pagination"></div>
  `;
  
  const searchBar = createSearchBar({
    placeholder: 'Buscar insumos...',
    initialValue: data.search || '',
    onSearch: async (query) => {
      pageData.supplies.search = query;
      await loadSuppliesData(pageData, 1, query);
      renderSuppliesPage(document.getElementById('page-content'), pageData);
    }
  });
  document.getElementById('search-supplies').appendChild(searchBar);
  
  document.getElementById('download-template-btn')?.addEventListener('click', async () => {
    try {
      const blob = await api.getBlob('/supplies/template');
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = 'plantilla-insumos.xlsx'; a.click();
      URL.revokeObjectURL(url);
    } catch (e) { showToast('Error al descargar plantilla', 'error'); }
  });

  document.getElementById('export-supplies-btn')?.addEventListener('click', async () => {
    try {
      const blob = await api.getBlob('/supplies/export');
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = 'insumos-exportados.xlsx'; a.click();
      URL.revokeObjectURL(url);
    } catch (e) { showToast('Error al exportar', 'error'); }
  });

  document.getElementById('import-supplies-btn')?.addEventListener('click', () => {
    document.getElementById('import-supplies-input')?.click();
  });

  document.getElementById('import-supplies-input')?.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const formData = new FormData();
    formData.append('file', file);
    try {
      const result = await api.postFormData('/supplies/import', formData);
      showToast(`✅ ${result.imported || result.created} insumos importados correctamente`, 'success');
      if (result.errors?.length) {
        console.warn('Errores de importación:', result.errors);
        showToast(`⚠️ ${result.errors.length} filas con errores (ver consola)`, 'warning');
      }
      await loadSuppliesData(pageData, 1, pageData.supplies?.search || ''); 
      renderSuppliesPage(document.getElementById('page-content'), pageData);
    } catch (e) { showToast(e.message || 'Error al importar', 'error'); }
    e.target.value = '';
  });
  
  const listEl = document.getElementById('supplies-list');
  if (data.data?.length) {
    listEl.innerHTML = `
      <table class="data-table">
        <thead><tr><th>Nombre</th><th>Marca</th><th>Stock</th><th>Precio</th><th>Estado</th></tr></thead>
        <tbody>${data.data.map(s => {
          const isLow = s.quantity <= (s.minQuantity || 10);
          return `
            <tr>
              <td>${s.name}</td>
              <td>${s.brand || '-'}</td>
              <td>${s.quantity}</td>
              <td>${formatCurrency(s.unitPrice)}</td>
              <td><span class="badge badge-${isLow ? 'danger' : 'success'}">${isLow ? 'Bajo stock' : 'OK'}</span></td>
            </tr>
          `;
        }).join('')}</tbody>
      </table>
    `;
  } else {
    listEl.innerHTML = '<div class="empty-state"><p>No hay insumos</p></div>';
  }
  
  const paginationEl = document.getElementById('supplies-pagination');
  if (paginationEl && data.meta?.totalPages > 1) {
    paginationEl.innerHTML = '';
    const pagination = createPagination({
      total: data.meta.total,
      page: data.page || 1,
      limit: 20,
      onPageChange: async (newPage) => {
        await loadSuppliesData(pageData, newPage, pageData.supplies?.search || '');
        renderSuppliesPage(document.getElementById('page-content'), pageData);
      }
    });
    paginationEl.appendChild(pagination);
  }
  
  document.getElementById('add-supply-btn')?.addEventListener('click', () => showAddSupplyModal(pageData));
}

export function showAddSupplyModal(pageData) {
  openModal({
    title: 'Nuevo Insumo',
    content: `
      <div class="form-group">
        <label class="form-label required">Nombre</label>
        <input type="text" class="form-input" id="supply-name">
      </div>
      <div class="form-group">
        <label class="form-label">Marca</label>
        <input type="text" class="form-input" id="supply-brand">
      </div>
      <div class="form-group">
        <label class="form-label">Categoría</label>
        <select class="form-input" id="supply-category">
          <option value="">Seleccionar...</option>
          <option value="MEDICAMENTO">Medicamento</option>
          <option value="INSUMO">Insumo</option>
          <option value="ALIMENTO">Alimento</option>
          <option value="OTRO">Otro</option>
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Unidad</label>
        <input type="text" class="form-input" id="supply-unit" placeholder="ej: ml, comprimido">
      </div>
      <div class="form-group">
        <label class="form-label">Cantidad</label>
        <input type="number" class="form-input" id="supply-quantity">
      </div>
      <div class="form-group">
        <label class="form-label">Precio unitario</label>
        <input type="number" step="0.01" class="form-input" id="supply-price">
      </div>
      <div class="form-group">
        <label class="form-label">Stock mínimo</label>
        <input type="number" class="form-input" id="supply-minQuantity">
      </div>
    `,
    onConfirm: async () => {
      const name = document.getElementById('supply-name').value.trim();
      if (!name) {
        showFieldError('supply-name', 'El nombre es requerido');
        return false;
      }
      
      try {
        await api.post('/supplies', {
          name,
          brand: document.getElementById('supply-brand').value.trim(),
          category: document.getElementById('supply-category').value,
          unit: document.getElementById('supply-unit').value.trim(),
          quantity: parseInt(document.getElementById('supply-quantity').value) || 0,
          unitPrice: parseFloat(document.getElementById('supply-price').value) || 0,
          minQuantity: parseInt(document.getElementById('supply-minQuantity').value) || 10,
        });
        
        showToast('Insumo creado', 'success');
        await loadSuppliesData(pageData, 1, pageData.supplies?.search || '');
        renderSuppliesPage(document.getElementById('page-content'), pageData);
      } catch (e) {
        showToast(e.message || 'Error creando insumo', 'error');
        return false;
      }
    }
  });
}
