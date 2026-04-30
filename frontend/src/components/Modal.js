const modalStack = [];

const Modal = {
  open(options) {
    const { title, content, onConfirm, onCancel, size = 'medium', confirmText = 'Confirmar', cancelText = 'Cancelar', showConfirm = true, showCancel = true } = options;

    if (modalStack.length > 0) {
      const topModal = modalStack[modalStack.length - 1];
      topModal.overlay.style.zIndex = '999';
      topModal.modal.style.zIndex = '999';
    }

    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.dataset.modal = 'true';

    const modal = document.createElement('div');
    modal.className = `modal modal-${size}`;

    const zIndex = 1000 + modalStack.length * 10;
    overlay.style.zIndex = zIndex.toString();
    modal.style.zIndex = zIndex.toString();

    modal.innerHTML = `
      <div class="modal-header">
        <h3 class="modal-title">${title}</h3>
        <button class="modal-close" data-modal-close>&times;</button>
      </div>
      <div class="modal-body">
        ${typeof content === 'function' ? '' : content}
      </div>
      <div class="modal-footer">
        ${showCancel ? `<button class="btn btn-secondary" data-modal-cancel>${cancelText}</button>` : ''}
        ${showConfirm ? `<button class="btn btn-primary" data-modal-confirm>${confirmText}</button>` : ''}
      </div>
    `;

    if (typeof content === 'function') {
      const contentContainer = modal.querySelector('.modal-body');
      content(contentContainer);
    }

    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    if (modalStack.length === 0) {
      document.body.classList.add('modal-open');
      document.addEventListener('keydown', handleEscape);
    }

    const modalData = { overlay, modal, onConfirm, onCancel };
    modalStack.push(modalData);

    const closeBtn = modal.querySelector('[data-modal-close]');
    closeBtn?.addEventListener('click', () => this.close());

    const cancelBtn = modal.querySelector('[data-modal-cancel]');
    cancelBtn?.addEventListener('click', () => {
      if (onCancel) onCancel();
      this.close();
    });

    const confirmBtn = modal.querySelector('[data-modal-confirm]');
    confirmBtn?.addEventListener('click', async () => {
      if (onConfirm) {
        confirmBtn.disabled = true;
        try {
          const result = await onConfirm();
          if (result !== false) {
            this.close();
          } else {
            confirmBtn.disabled = false;
          }
        } catch (error) {
          confirmBtn.disabled = false;
          throw error;
        }
      } else {
        this.close();
      }
    });

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        if (onCancel) onCancel();
        this.close();
      }
    });

    requestAnimationFrame(() => {
      overlay.classList.add('modal-visible');
    });

    return modal;
  },

  close() {
    if (modalStack.length === 0) return;

    const modalData = modalStack.pop();
    const { overlay } = modalData;

    overlay.classList.remove('modal-visible');
    overlay.classList.add('modal-hiding');

    setTimeout(() => {
      overlay.remove();

      if (modalStack.length > 0) {
        const topModal = modalStack[modalStack.length - 1];
        topModal.overlay.style.zIndex = '';
        topModal.modal.style.zIndex = '';
      } else {
        document.body.classList.remove('modal-open');
        document.removeEventListener('keydown', handleEscape);
      }
    }, 300);
  },

  closeAll() {
    while (modalStack.length > 0) {
      const modalData = modalStack.pop();
      modalData.overlay.remove();
    }
    document.body.classList.remove('modal-open');
    document.removeEventListener('keydown', handleEscape);
  },

  setContent(content) {
    if (modalStack.length === 0) return;
    const activeModal = modalStack[modalStack.length - 1];
    const body = activeModal.modal.querySelector('.modal-body');
    if (typeof content === 'function') {
      content(body);
    } else {
      body.innerHTML = content;
    }
  },

  showLoading() {
    if (modalStack.length === 0) return;
    const activeModal = modalStack[modalStack.length - 1];
    const footer = activeModal.modal.querySelector('.modal-footer');
    footer.innerHTML = '<span class="modal-loading">Cargando...</span>';
  },

  hideLoading(confirmText = 'Confirmar', showCancel = true) {
    if (modalStack.length === 0) return;
    const activeModal = modalStack[modalStack.length - 1];
    const footer = activeModal.modal.querySelector('.modal-footer');
    footer.innerHTML = `
      ${showCancel ? '<button class="btn btn-secondary" data-modal-cancel>Cancelar</button>' : ''}
      <button class="btn btn-primary" data-modal-confirm">${confirmText}</button>
    `;

    const cancelBtn = footer.querySelector('[data-modal-cancel]');
    cancelBtn?.addEventListener('click', () => {
      if (activeModal?.onCancel) activeModal.onCancel();
      this.close();
    });

    const confirmBtn = footer.querySelector('[data-modal-confirm]');
    confirmBtn?.addEventListener('click', async () => {
      if (activeModal?.onConfirm) {
        confirmBtn.disabled = true;
        try {
          const result = await activeModal.onConfirm();
          if (result !== false) {
            this.close();
          } else {
            confirmBtn.disabled = false;
          }
        } catch (error) {
          confirmBtn.disabled = false;
          throw error;
        }
      } else {
        this.close();
      }
    });
  },

  setConfirmCallback(onConfirm) {
    if (modalStack.length === 0) return;
    const activeModal = modalStack[modalStack.length - 1];
    activeModal.onConfirm = onConfirm;
  },

  isOpen() {
    return modalStack.length > 0;
  }
};

function handleEscape(e) {
  if (e.key === 'Escape' && modalStack.length > 0) {
    const activeModal = modalStack[modalStack.length - 1];
    if (activeModal.onCancel) {
      activeModal.onCancel();
    }
    Modal.close();
  }
}

export function openModal(optionsOrName, extraOptions = {}) {
  let options;
  
  if (typeof optionsOrName === 'string') {
    const modalName = optionsOrName;
    const config = window.modalConfigs?.[modalName] || {};
    const data = extraOptions?.data || {};
    const type = extraOptions?.type || '';
    
    options = {
      title: extraOptions?.title || config.title || modalName,
      size: config.size || 'medium',
      confirmText: 'Guardar',
      cancelText: 'Cancelar',
      onConfirm: async () => {
        const formData = {};
        config.fields?.forEach(field => {
          const el = document.getElementById(`modal-field-${field.name}`);
          if (el) {
            if (field.type === 'checkbox') {
              formData[field.name] = el.checked;
            } else if (field.type === 'select') {
              formData[field.name] = el.value;
            } else {
              formData[field.name] = el.value;
            }
          }
        });
        
        if (config.onSubmit) {
          await config.onSubmit({ ...data, ...formData });
        }
      },
    };
    
    options.content = (container) => {
      let fieldsHTML = '';
      
      if (config.fields) {
        fieldsHTML = config.fields.map(field => {
          let inputHTML = '';
          const value = data[field.name] || '';
          
          if (field.type === 'select') {
            inputHTML = `
              <select id="modal-field-${field.name}" class="form-input" ${field.required ? 'required' : ''}>
                <option value="">Seleccionar...</option>
                ${field.options?.map(opt => `
                  <option value="${opt.value}" ${opt.value === value ? 'selected' : ''}>${opt.label}</option>
                `).join('')}
              </select>
            `;
          } else if (field.type === 'textarea') {
            inputHTML = `<textarea id="modal-field-${field.name}" class="form-input" rows="3" ${field.required ? 'required' : ''}>${value}</textarea>`;
          } else if (field.type === 'checkbox') {
            inputHTML = `<input type="checkbox" id="modal-field-${field.name}" ${value ? 'checked' : ''}>`;
          } else if (field.type === 'datetime-local') {
            inputHTML = `<input type="datetime-local" id="modal-field-${field.name}" class="form-input" value="${value}" ${field.required ? 'required' : ''}">`;
          } else if (field.type === 'date') {
            inputHTML = `<input type="date" id="modal-field-${field.name}" class="form-input" value="${value}" ${field.required ? 'required' : ''}>`;
          } else if (field.type === 'number') {
            inputHTML = `<input type="number" id="modal-field-${field.name}" class="form-input" step="0.01" value="${value}" ${field.required ? 'required' : ''}>`;
          } else if (field.type === 'email') {
            inputHTML = `<input type="email" id="modal-field-${field.name}" class="form-input" value="${value}" ${field.required ? 'required' : ''}>`;
          } else if (field.type === 'tel') {
            inputHTML = `<input type="tel" id="modal-field-${field.name}" class="form-input" value="${value}" ${field.required ? 'required' : ''}>`;
          } else {
            inputHTML = `<input type="text" id="modal-field-${field.name}" class="form-input" value="${value}" ${field.required ? 'required' : ''}>`;
          }
          
          return `
            <div class="form-group">
              <label class="form-label">${field.label}${field.required ? ' *' : ''}</label>
              ${inputHTML}
            </div>
          `;
        }).join('');
      }
      
      if (type) {
        fieldsHTML = `<input type="hidden" id="modal-field-type" value="${type}">` + fieldsHTML;
      }
      
      container.innerHTML = fieldsHTML || optionsOrName;
    };
  } else {
    options = optionsOrName;
  }
  
  return Modal.open(options);
}

export function closeModal() {
  return Modal.close();
}

export function closeAllModals() {
  return Modal.closeAll();
}

export default Modal;
