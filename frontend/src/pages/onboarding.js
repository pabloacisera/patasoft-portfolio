import { api } from '../services/api.js';
import { router } from '../router.js';
import { isAuthenticated } from '../stores/auth.store.js';
import { createStepForm } from '../components/StepForm.js';
import { openModal, closeModal } from '../components/Modal.js';
import { showToast } from '../components/Toast.js';
import { validateRequired, validateEmail, validateDNI, validateCUIT, showFieldError, clearFieldErrors } from '../utils/validators.js';

const SPECIALTIES = [
  { id: 'DOG', label: 'Perros', icon: '🐕' },
  { id: 'CAT', label: 'Gatos', icon: '🐱' },
  { id: 'HORSE', label: 'Caballos', icon: '🐴' },
  { id: 'BIRD', label: 'Aves', icon: '🐦' },
  { id: 'RABBIT', label: 'Conejos', icon: '🐰' },
  { id: 'REPTILE', label: 'Reptiles', icon: '🦎' },
  { id: 'GENERAL', label: 'Medicina General', icon: '⚕️' },
];

export async function renderOnboarding() {
  const app = document.getElementById('app');

  if (isAuthenticated()) {
    try {
      const company = await api.get('/companies/me');
      if (company && (company.name || company?.data?.name)) {
        router.navigate('/dashboard');
        return;
      }
    } catch (e) {
      if (e.message !== 'ONBOARDING_REQUIRED') {
        console.warn('[Onboarding] Error verificando empresa:', e.message);
      }
    }
  }

  app.innerHTML = getOnboardingLayout();

  const form = createStepForm({
    steps: [
      {
        title: 'Datos de Empresa',
        content: renderStep1,
        validate: () => validateStep1(),
      },
      {
        title: 'Especialidades',
        content: renderStep2,
        validate: () => validateStep2(),
      },
      {
        title: 'Confirmar',
        content: renderStep3,
      },
    ],
    onComplete: async () => {
      await saveOnboardingData(window.onboardingData);
    },

    onCancel: () => {
      router.navigate('/login');
    },
  });

  const container = document.getElementById('onboarding-form');
  container.appendChild(form);

  window.onboardingData = {
    company: {},
    specialties: [],
  };
}

function getOnboardingLayout() {
  return `
    <style>
      .onboarding-container { max-width: 680px; margin: 0 auto; padding: var(--space-8) var(--space-4); min-height: 100vh; }
      .onboarding-header { text-align: center; margin-bottom: var(--space-10); }
      .onboarding-logo { font-family: var(--font-display); font-size: var(--text-3xl); color: var(--color-forest); margin-bottom: var(--space-2); }
      .onboarding-subtitle { color: var(--text-secondary); font-size: var(--text-base); font-weight: normal; margin: 0; }
      #onboarding-form { background: var(--surface); border-radius: var(--radius-xl); padding: var(--space-8); box-shadow: var(--shadow); }
      .form-row { display: grid; grid-template-columns: 1fr; gap: var(--space-4); }
      .specialties-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: var(--space-3); }
      .specialty-item { padding: var(--space-5) var(--space-4); border: 1.5px solid var(--border); border-radius: var(--radius-lg); cursor: pointer; text-align: center; transition: all var(--transition); }
      .specialty-item:hover { border-color: var(--color-sage); background: var(--color-success-light); }
      .specialty-item.selected { border-color: var(--color-forest); background: rgba(27,67,50,0.05); }
      .specialty-icon { font-size: 2rem; margin-bottom: var(--space-2); display: block; }
      .specialty-label { font-size: var(--text-sm); font-weight: 500; }
      .summary-card { background: var(--bg); padding: var(--space-5); border-radius: var(--radius-lg); margin-bottom: var(--space-4); }
      .summary-row { display: flex; justify-content: space-between; padding: var(--space-3) 0; border-bottom: 1px solid var(--border); }
      .summary-row:last-child { border-bottom: none; }
      .summary-label { color: var(--text-secondary); font-size: var(--text-sm); }
      .summary-value { font-weight: 600; }
    </style>

    <div class="onboarding-container">
      <div class="onboarding-header">
        <div class="onboarding-logo">PataSoft</div>
        <h1 class="onboarding-subtitle">Configuración de empresa</h1>
      </div>
      <div id="onboarding-form"></div>
    </div>
  `;
}

function renderStep1(container) {
  container.innerHTML = `
    <div class="form-row">
      <div class="form-group">
        <label class="form-label required">Nombre de la Empresa</label>
        <input type="text" class="form-input" id="company-name" placeholder="Nombre">
        <div class="field-error" id="company-name-error"></div>
      </div>
      <div class="form-group">
        <label class="form-label">Razón Social</label>
        <input type="text" class="form-input" id="company-business-name" placeholder="Razón social">
      </div>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label class="form-label required">CUIT</label>
        <input type="text" class="form-input" id="company-cuit" placeholder="XX-XXXXXXXX-X">
        <div class="field-error" id="company-cuit-error"></div>
      </div>
      <div class="form-group">
        <label class="form-label">Teléfono</label>
        <input type="tel" class="form-input" id="company-phone" placeholder="+54 9 XXX XXXX-XXXX">
      </div>
    </div>
    <div class="form-group">
      <label class="form-label required">Dirección</label>
      <input type="text" class="form-input" id="company-address" placeholder="Dirección">
    </div>
    <div class="form-group">
      <label class="form-label">Email</label>
      <input type="email" class="form-input" id="company-email" placeholder="email@ejemplo.com">
      <div class="field-error" id="company-email-error"></div>
    </div>
    <div class="form-group">
      <label class="form-label">Website</label>
      <input type="url" class="form-input" id="company-website" placeholder="https://ejemplo.com">
    </div>
  `;
}

function validateStep1() {
  clearFieldErrors('onboarding-form');
  let valid = true;

  const name = document.getElementById('company-name').value.trim();
  if (!name) {
    showFieldError('company-name', 'El nombre es requerido');
    valid = false;
  }

  const address = document.getElementById('company-address').value.trim();
  if (!address || address.length < 5) {
    showFieldError('company-address', 'La dirección es requerida (mínimo 5 caracteres)');
    valid = false;
  }

  const cuit = document.getElementById('company-cuit').value.trim();
  if (cuit) {
    try {
      validateCUIT(cuit);
    } catch (e) {
      showFieldError('company-cuit', e.message);
      valid = false;
    }
  }

  const email = document.getElementById('company-email').value.trim();
  if (email) {
    try {
      validateEmail(email);
    } catch (e) {
      showFieldError('company-email', e.message);
      valid = false;
    }
  }

  if (valid && window.onboardingData) {
    window.onboardingData.company = {
      name,
      businessName: document.getElementById('company-business-name').value.trim(),
      phone: document.getElementById('company-phone').value.trim(),
      address,
      email,
      website: document.getElementById('company-website').value.trim(),
      slug: name.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-'),
      cuit,
    };
  }

  return valid;
}

function renderStep2(container) {
  const selected = window.onboardingData?.specialties || [];

  container.innerHTML = `
    <p style="margin-bottom: 20px; color: var(--text-secondary);">
      Selecciona las especialidades de tu veterinaria:
    </p>
    <div class="specialties-grid">
      ${SPECIALTIES.map(s => `
        <div class="specialty-item ${selected.includes(s.id) ? 'selected' : ''}" data-specialty="${s.id}">
          <div class="specialty-icon">${s.icon}</div>
          <div class="specialty-label">${s.label}</div>
        </div>
      `).join('')}
    </div>
    <div class="field-error" id="specialties-error"></div>
  `;

  container.querySelectorAll('.specialty-item').forEach(item => {
    item.addEventListener('click', () => {
      const id = item.dataset.specialty;
      item.classList.toggle('selected');

      const idx = selected.indexOf(id);
      if (idx >= 0) {
        selected.splice(idx, 1);
      } else {
        selected.push(id);
      }

      if (window.onboardingData) {
        window.onboardingData.specialties = [...selected];
      }
    });
  });
}

function validateStep2() {
  const selected = window.onboardingData?.specialties || [];
  const errorEl = document.getElementById('specialties-error');

  if (selected.length === 0) {
    if (errorEl) {
      errorEl.textContent = 'Selecciona al menos una especialidad';
    }
    return false;
  }

  if (errorEl) {
    errorEl.textContent = '';
  }

  return true;
}

function renderStep3(container) {
  const data = window.onboardingData || {};
  const company = data.company || {};
  const specialties = data.specialties || [];

  const specialtyLabels = SPECIALTIES.filter(s => specialties.includes(s.id)).map(s => s.label).join(', ');

  container.innerHTML = `
    <p style="margin-bottom: 20px;">Por favor confirmá los datos de tu empresa:</p>

    <div class="summary-card">
      <div class="summary-row">
        <span class="summary-label">Nombre</span>
        <span class="summary-value">${company.name || '-'}</span>
      </div>
      <div class="summary-row">
        <span class="summary-label">Razón Social</span>
        <span class="summary-value">${company.businessName || '-'}</span>
      </div>
      <div class="summary-row">
        <span class="summary-label">CUIT</span>
        <span class="summary-value">${company.cuit || '-'}</span>
      </div>
      <div class="summary-row">
        <span class="summary-label">Teléfono</span>
        <span class="summary-value">${company.phone || '-'}</span>
      </div>
      <div class="summary-row">
        <span class="summary-label">Dirección</span>
        <span class="summary-value">${company.address || '-'}</span>
      </div>
      <div class="summary-row">
        <span class="summary-label">Email</span>
        <span class="summary-value">${company.email || '-'}</span>
      </div>
      <div class="summary-row">
        <span class="summary-label">Especialidades</span>
        <span class="summary-value">${specialtyLabels || '-'}</span>
      </div>
    </div>
  `;
}

async function saveOnboardingData(data) {
  const modal = openModal({
    title: 'Creando Empresa',
    content: '<p>Por favor esperá...</p>',
    showConfirm: false,
    showCancel: false,
  });

  try {
    const companyData = {
      name: data.company.name,
      legalName: data.company.businessName,
      address: data.company.address || '',
      phone: data.company.phone,
      email: data.company.email,
      animalSpecialties: data.specialties,
      cuit: data.company.cuit || '',
      ...(data.company.website && { website: data.company.website }),
    };

    await api.post('/companies', companyData);

    const { getRefreshToken, setToken } = await import('../stores/auth.store.js');
    const refreshToken = getRefreshToken();
    if (refreshToken) {
      try {
        const response = await fetch('/api/v1/auth/refresh', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken }),
        });
        if (response.ok) {
          const tokens = await response.json();
          setToken(tokens.accessToken, tokens.refreshToken);
        }
      } catch { }
    }
    closeModal();
    showToast('Empresa creada correctamente', 'success');
    router.navigate('/dashboard');
  } catch (error) {
    showToast(error.message || 'Error al crear empresa', 'error');
  }
}
