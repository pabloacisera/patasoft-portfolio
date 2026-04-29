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

export function openModal(options) {
  return Modal.open(options);
}

export function closeModal() {
  return Modal.close();
}

export function closeAllModals() {
  return Modal.closeAll();
}

export default Modal;
