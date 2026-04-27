let activeModal = null;

const Modal = {
  open(options) {
    const { title, content, onConfirm, onCancel, size = 'medium', confirmText = 'Confirmar', cancelText = 'Cancelar', showConfirm = true, showCancel = true } = options;

    if (activeModal) {
      this.close();
    }

    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.dataset.modal = 'true';

    const modal = document.createElement('div');
    modal.className = `modal modal-${size}`;
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
    document.body.classList.add('modal-open');

    activeModal = { overlay, modal, onConfirm, onCancel };

    const closeBtn = modal.querySelector('[data-modal-close]');
    closeBtn?.addEventListener('click', () => this.close());

    const cancelBtn = modal.querySelector('[data-modal-cancel]');
    cancelBtn?.addEventListener('click', () => {
      if (onCancel) onCancel();
      this.close();
    });

    const confirmBtn = modal.querySelector('[data-modal-confirm]');
    confirmBtn?.addEventListener('click', () => {
      if (onConfirm) {
        const result = onConfirm();
        if (result !== false) {
          this.close();
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

    document.addEventListener('keydown', handleEscape);

    requestAnimationFrame(() => {
      overlay.classList.add('modal-visible');
    });

    return modal;
  },

  close() {
    if (!activeModal) return;

    const { overlay, modal, onCancel } = activeModal;

    overlay.classList.remove('modal-visible');
    overlay.classList.add('modal-hiding');

    setTimeout(() => {
      overlay.remove();
      document.body.classList.remove('modal-open');
      activeModal = null;
    }, 300);

    document.removeEventListener('keydown', handleEscape);
  },

  setContent(content) {
    if (!activeModal) return;
    const body = activeModal.modal.querySelector('.modal-body');
    if (typeof content === 'function') {
      content(body);
    } else {
      body.innerHTML = content;
    }
  },

  showLoading() {
    if (!activeModal) return;
    const footer = activeModal.modal.querySelector('.modal-footer');
    footer.innerHTML = '<span class="modal-loading">Cargando...</span>';
  },

  hideLoading(confirmText = 'Confirmar', showCancel = true) {
    if (!activeModal) return;
    const footer = activeModal.modal.querySelector('.modal-footer');
    footer.innerHTML = `
      ${showCancel ? '<button class="btn btn-secondary" data-modal-cancel>Cancelar</button>' : ''}
      <button class="btn btn-primary" data-modal-confirm>${confirmText}</button>
    `;

    const cancelBtn = footer.querySelector('[data-modal-cancel]');
    cancelBtn?.addEventListener('click', () => {
      if (activeModal?.onCancel) activeModal.onCancel();
      this.close();
    });

    const confirmBtn = footer.querySelector('[data-modal-confirm]');
    confirmBtn?.addEventListener('click', () => {
      if (activeModal?.onConfirm) {
        const result = activeModal.onConfirm();
        if (result !== false) {
          this.close();
        }
      } else {
        this.close();
      }
    });
  },

  setConfirmCallback(onConfirm) {
    if (!activeModal) return;
    activeModal.onConfirm = onConfirm;
  },

  isOpen() {
    return activeModal !== null;
  }
};

function handleEscape(e) {
  if (e.key === 'Escape' && activeModal) {
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

export default Modal;