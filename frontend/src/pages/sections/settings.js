import { api } from '../../services/api.js';
import { router } from '../../router.js';
import { formatDate, formatCurrency, formatStatus } from '../../utils/formatters.js';
import { createPagination } from '../../components/Pagination.js';
import Modal, { openModal, closeModal } from '../../components/Modal.js';
import { showToast } from '../../components/Toast.js';
import { escapeHtml } from '../../utils/escape.js';
import { showFieldError } from '../../utils/validators.js';
import { createSpinner } from '../../components/Spinner.js';

function debounce(fn, delay = 300) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

export async function renderSettingsPage(tab, pageData) {
  const content = document.getElementById('page-content');
  if (!content) return;
  content.replaceChildren();
  content.insertAdjacentHTML('beforeend', `
    <style>
      .subscription-status-card { background: var(--surface); border: 1.5px solid var(--border); border-radius: var(--radius-xl); padding: var(--space-6); margin-bottom: var(--space-6); }
      .subscription-status-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: var(--space-4); }
      .subscription-badge { display: inline-flex; align-items: center; gap: var(--space-2); padding: var(--space-1) var(--space-3); border-radius: var(--radius-full); font-size: var(--text-sm); font-weight: 600; }
      .badge-trial { background: rgba(245,158,11,0.12); color: #b45309; }
      .badge-active { background: rgba(16,185,129,0.12); color: #065f46; }
      .badge-expired { background: rgba(239,68,68,0.12); color: #991b1b; }
      .badge-cancelled { background: rgba(107,114,128,0.12); color: #374151; }
      .subscription-meta { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: var(--space-4); margin-top: var(--space-4); }
      .subscription-meta-item { display: flex; flex-direction: column; gap: var(--space-1); }
      .subscription-meta-label { font-size: var(--text-xs); color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.05em; }
      .subscription-meta-value { font-size: var(--text-base); font-weight: 600; color: var(--text-primary); }
      .plans-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: var(--space-4); margin-bottom: var(--space-6); }
      .plan-card { border: 2px solid var(--border); border-radius: var(--radius-xl); padding: var(--space-6); position: relative; transition: all var(--transition); cursor: pointer; }
      .plan-card:hover { border-color: var(--color-sage); box-shadow: var(--shadow-md); }
      .plan-card.featured { border-color: var(--color-forest); background: rgba(27,67,50,0.03); }
      .plan-card.current { border-color: var(--color-sage); background: rgba(106,153,85,0.05); }
      .plan-badge-featured { position: absolute; top: -12px; left: 50%; transform: translateX(-50%); background: var(--color-forest); color: white; font-size: var(--text-xs); font-weight: 700; padding: 2px 12px; border-radius: var(--radius-full); white-space: nowrap; }
      .plan-name { font-size: var(--text-lg); font-weight: 700; color: var(--text-primary); margin-bottom: var(--space-1); }
      .plan-price { font-size: var(--text-3xl); font-weight: 800; color: var(--color-forest); margin-bottom: var(--space-1); }
      .plan-price span { font-size: var(--text-sm); font-weight: 400; color: var(--text-secondary); }
      .plan-saving { font-size: var(--text-xs); color: #065f46; background: rgba(16,185,129,0.1); padding: 2px 8px; border-radius: var(--radius-full); display: inline-block; margin-bottom: var(--space-3); }
      .plan-features { list-style: none; padding: 0; margin: var(--space-4) 0; display: flex; flex-direction: column; gap: var(--space-2); }
      .plan-features li { font-size: var(--text-sm); color: var(--text-secondary); display: flex; align-items: center; gap: var(--space-2); }
      .plan-features li::before { content: "✓"; color: var(--color-forest); font-weight: 700; }
      .plan-btn { width: 100%; margin-top: var(--space-2); }
      .subscription-trial-banner { background: linear-gradient(135deg, rgba(245,158,11,0.1), rgba(217,119,6,0.08)); border: 1.5px solid rgba(245,158,11,0.3); border-radius: var(--radius-lg); padding: var(--space-4); margin-bottom: var(--space-6); display: flex; align-items: center; gap: var(--space-3); }
      .trial-banner-icon { font-size: 1.5rem; }
      .trial-banner-text strong { display: block; color: #92400e; font-weight: 700; }
      .trial-banner-text span { font-size: var(--text-sm); color: #b45309; }
    </style>
    <div class="settings-nav">
      <a class="settings-tab ${tab === 'company' ? 'active' : ''}" href="/settings/company">Empresa</a>
      <a class="settings-tab ${tab === 'subscription' ? 'active' : ''}" href="/settings/subscription">Suscripción</a>
      <a class="settings-tab ${tab === 'mercadopago' ? 'active' : ''}" href="/settings/mercadopago">MercadoPago</a>
      <a class="settings-tab ${tab === 'prices' ? 'active' : ''}" href="/settings/prices">Precios</a>
      <a class="settings-tab ${tab === 'ai' ? 'active' : ''}" href="/settings/ai">IA</a>
      <a class="settings-tab ${tab === 'connections' ? 'active' : ''}" href="/settings/connections">Conexiones</a>
      <a class="settings-tab ${tab === 'export' ? 'active' : ''}" href="/settings/export-data">Exportar datos</a>
    </div>
    <div id="settings-content"></div>
  `);
  
  document.querySelectorAll('.settings-tab').forEach(t => {
    t.addEventListener('click', (e) => {
      e.preventDefault();
      router.navigate(t.getAttribute('href'));
    });
  });
  
  const contentEl = document.getElementById('settings-content');
  
  switch (tab) {
    case 'company': await renderSettingsCompanyContent(contentEl, pageData); break;
    case 'subscription': await renderSettingsSubscriptionContent(contentEl, pageData); break;
    case 'mercadopago': await renderSettingsMercadoPagoContent(contentEl, pageData); break;
    case 'prices': await renderSettingsPricesContent(contentEl, pageData); break;
    case 'ai': await renderSettingsAIContent(contentEl, pageData); break;
    case 'connections': await renderSettingsConnectionsContent(contentEl, pageData); break;
    case 'export': await renderExportDataContent(contentEl, pageData); break;
  }
}

async function renderSettingsCompanyContent(content, pageData) {
  try {
    const { data: company } = await api.get('/companies/me');
    
    content.replaceChildren();
    content.insertAdjacentHTML('beforeend', `
      <div class="settings-section">
        <h3>Información de la Empresa</h3>
        <div class="form-group">
          <label class="form-label">Nombre</label>
          <input type="text" class="form-input" id="company-name" value="${escapeHtml(company?.name || '')}">
        </div>
        <div class="form-group">
          <label class="form-label">Razón Social</label>
          <input type="text" class="form-input" id="company-legalName" value="${escapeHtml(company?.legalName || '')}">
        </div>
        <div class="form-group">
          <label class="form-label">Teléfono</label>
          <input type="tel" class="form-input" id="company-phone" value="${escapeHtml(company?.phone || '')}">
        </div>
        <div class="form-group">
          <label class="form-label">Dirección</label>
          <input type="text" class="form-input" id="company-address" value="${escapeHtml(company?.address || '')}">
        </div>
        <div class="form-group">
          <label class="form-label">Email</label>
          <input type="email" class="form-input" id="company-email" value="${escapeHtml(company?.email || '')}">
        </div>
        <div class="form-group">
          <label class="form-label">Website</label>
          <input type="url" class="form-input" id="company-website" value="${escapeHtml(company?.website || '')}">
        </div>
        <button class="btn btn-primary" id="save-company-btn">Guardar</button>
      </div>
    `);
    
    document.getElementById('save-company-btn').addEventListener('click', async () => {
      try {
        await api.patch('/companies/me', {
          name: document.getElementById('company-name').value,
          legalName: document.getElementById('company-legalName').value,
          phone: document.getElementById('company-phone').value,
          address: document.getElementById('company-address').value,
          email: document.getElementById('company-email').value,
          website: document.getElementById('company-website').value,
        });
        showToast('Empresa actualizada', 'success');
      } catch (e) {
        showToast(e.message || 'Error guardando', 'error');
      }
    });
  } catch (e) {
    content.replaceChildren();
    content.insertAdjacentHTML('beforeend', '<div class="empty-state" role="status"><p>Error cargando datos</p></div>');
  }
}

async function renderSettingsSubscriptionContent(content, pageData) {
  content.replaceChildren();
  const loadingEl = document.createElement('div');
  loadingEl.style.display = 'flex';
  loadingEl.style.justifyContent = 'center';
  loadingEl.style.padding = '40px';
  loadingEl.appendChild(createSpinner({ size: '40px' }));
  content.appendChild(loadingEl);
  
  let sub;
  try {
    sub = await api.get('/subscriptions/status');
  } catch (e) {
    content.replaceChildren();
    content.insertAdjacentHTML('beforeend', '<div class="empty-state" role="status"><p>Error cargando suscripción. Intenta nuevamente.</p></div>');
    return;
  }

  const now = new Date();
  const trialEnd = sub.trialEndsAt ? new Date(sub.trialEndsAt) : null;
  const expireEnd = sub.expiresAt ? new Date(sub.expiresAt) : null;
  const trialDaysLeft = trialEnd ? Math.max(0, Math.ceil((trialEnd - now) / (1000 * 60 * 60 * 24))) : 0;
  const expireDaysLeft = expireEnd ? Math.max(0, Math.ceil((expireEnd - now) / (1000 * 60 * 60 * 24))) : 0;

  const statusLabels = { TRIAL: 'Prueba gratuita', ACTIVE: 'Activo', EXPIRED: 'Expirado', CANCELLED: 'Cancelado', BLOCKED: 'Bloqueado' };
  const statusBadgeClass = { TRIAL: 'badge-trial', ACTIVE: 'badge-active', EXPIRED: 'badge-expired', CANCELLED: 'badge-cancelled', BLOCKED: 'badge-expired' };
  const planLabels = { TRIAL: 'Trial', MONTHLY: 'Mensual', YEARLY: 'Anual' };

  const isActive = sub.status === 'ACTIVE';
  const isTrial = sub.status === 'TRIAL';
  const isExpired = ['EXPIRED', 'BLOCKED'].includes(sub.status);
  const isCancelled = sub.status === 'CANCELLED';

  const trialBanner = isTrial ? `
    <div class="subscription-trial-banner">
      <div class="trial-banner-icon">⏳</div>
      <div class="trial-banner-text">
        <strong>Estás en el período de prueba gratuita</strong>
        <span>${trialDaysLeft > 0 ? `Te quedan ${trialDaysLeft} días` : 'Tu trial ha vencido'}. Suscribite para continuar usando PataSoft.</span>
      </div>
    </div>
  ` : '';

  const expiredBanner = isExpired ? `
    <div class="subscription-trial-banner" style="background: rgba(239,68,68,0.08); border-color: rgba(239,68,68,0.3);">
      <div class="trial-banner-icon">🔒</div>
      <div class="trial-banner-text">
        <strong style="color:#991b1b;">Tu suscripción ha vencido</strong>
        <span style="color:#b91c1c;">Renová tu plan para recuperar el acceso completo.</span>
      </div>
    </div>
  ` : '';

  content.replaceChildren();
  content.insertAdjacentHTML('beforeend', `
    <div class="settings-section">
      <h3>Suscripción</h3>

      ${trialBanner}
      ${expiredBanner}

      <div class="subscription-status-card">
        <div class="subscription-status-header">
          <div>
            <div style="font-size: var(--text-sm); color: var(--text-secondary); margin-bottom: var(--space-1);">Plan actual</div>
            <div style="font-size: var(--text-xl); font-weight: 700;">${escapeHtml(planLabels[sub.plan] || sub.plan)}</div>
          </div>
          <span class="subscription-badge ${statusBadgeClass[sub.status] || 'badge-trial'}">
            ${escapeHtml(statusLabels[sub.status] || sub.status)}
          </span>
        </div>
        <div class="subscription-meta">
          ${isTrial && trialEnd ? `
            <div class="subscription-meta-item">
              <span class="subscription-meta-label">Trial vence</span>
              <span class="subscription-meta-value">${formatDate(sub.trialEndsAt)}</span>
            </div>
          ` : ''}
          ${isActive && expireEnd ? `
            <div class="subscription-meta-item">
              <span class="subscription-meta-label">Próximo vencimiento</span>
              <span class="subscription-meta-value">${formatDate(sub.expiresAt)} (${expireDaysLeft} días)</span>
            </div>
          ` : ''}
          ${isCancelled && sub.cancelledAt ? `
            <div class="subscription-meta-item">
              <span class="subscription-meta-label">Cancelado el</span>
              <span class="subscription-meta-value">${formatDate(sub.cancelledAt)}</span>
            </div>
          ` : ''}
          <div class="subscription-meta-item">
            <span class="subscription-meta-label">Desde</span>
            <span class="subscription-meta-value">${formatDate(sub.startedAt)}</span>
          </div>
        </div>
      </div>

      <h4 style="margin-bottom: var(--space-4); color: var(--text-secondary); font-weight: 600; text-transform: uppercase; font-size: var(--text-sm); letter-spacing: 0.05em;">
        ${isActive ? 'Cambiar plan' : 'Elegí tu plan'}
      </h4>

      <div class="plans-grid">
        <div class="plan-card ${sub.plan === 'MONTHLY' && isActive ? 'current' : ''}">
          ${sub.plan === 'MONTHLY' && isActive ? '<div class="plan-badge-featured">Plan actual</div>' : ''}
          <div class="plan-name">Mensual</div>
          <div class="plan-price">$27.000 <span>/ mes</span></div>

          <ul class="plan-features">
            <li>Clientes y mascotas ilimitados</li>
            <li>Historiales clínicos completos</li>
            <li>Gestión de insumos y stock</li>
            <li>Pagos y deudas</li>
            <li>Chat con IA veterinaria</li>
            <li>Soporte por email</li>
          </ul>
          <button class="btn ${sub.plan === 'MONTHLY' && isActive ? 'btn-secondary' : 'btn-primary'} plan-btn" 
                  id="btn-subscribe-monthly"
                  ${sub.plan === 'MONTHLY' && isActive ? 'disabled' : ''}>
            ${sub.plan === 'MONTHLY' && isActive ? 'Plan activo' : 'Suscribirme mensual'}
          </button>
        </div>

        <div class="plan-card featured ${sub.plan === 'YEARLY' && isActive ? 'current' : ''}">
          ${sub.plan === 'YEARLY' && isActive ? '<div class="plan-badge-featured">Plan actual</div>' : '<div class="plan-badge-featured">Recomendado</div>'}
          <div class="plan-name">Anual</div>
          <div class="plan-price">$240.000 <span>/ año</span></div>
          <div class="plan-saving">Ahorrás $84.000 vs mensual</div>

          <ul class="plan-features">
            <li>Todo lo del plan mensual</li>
            <li>2 meses gratis</li>
            <li>Conexiones con otras clínicas</li>
            <li>Exportación de reportes PDF</li>
            <li>Soporte prioritario</li>
            <li>Configuración de precios personalizada</li>
          </ul>
          <button class="btn ${sub.plan === 'YEARLY' && isActive ? 'btn-secondary' : 'btn-primary'} plan-btn"
                  id="btn-subscribe-yearly"
                  ${sub.plan === 'YEARLY' && isActive ? 'disabled' : ''}>
            ${sub.plan === 'YEARLY' && isActive ? 'Plan activo' : 'Suscribirme anual'}
          </button>
          <button
            class="btn btn-outline btn-sm"
            id="btn-subscribe-test"
            style="margin-top: var(--space-4); opacity: 0.5; font-size: 11px;"
          >
            [TEST] $150 por 2 días
          </button>
        </div>
      </div>

      ${isActive ? `
        <div style="border-top: 1px solid var(--border); padding-top: var(--space-6); margin-top: var(--space-2);">
          <h4 style="margin-bottom: var(--space-2); color: var(--text-primary);">Cancelar suscripción</h4>
          <p style="font-size: var(--text-sm); color: var(--text-secondary); margin-bottom: var(--space-4);">
            Al cancelar, podrás seguir usando PataSoft hasta el ${formatDate(sub.expiresAt)}. No se realizará ningún cargo adicional.
          </p>
          <button class="btn btn-secondary" id="btn-cancel-subscription">Cancelar suscripción</button>
        </div>
      ` : ''}
    </div>
  `);

  async function handleSubscribe(plan) {
    const btn = document.getElementById(`btn-subscribe-${plan.toLowerCase()}`);
    if (!btn || btn.disabled) return;
    
    const originalText = btn.textContent;
    btn.disabled = true;
    btn.textContent = 'Procesando...';
    
    try {
      const result = await api.post('/subscriptions/checkout', { plan: plan.toUpperCase() });
      if (result.initPoint) {
        window.location.href = result.initPoint;
      } else {
        showToast('Error al iniciar el pago', 'error');
        btn.disabled = false;
        btn.textContent = originalText;
      }
    } catch (e) {
      showToast(e.message || 'Error al procesar la suscripción', 'error');
      btn.disabled = false;
      btn.textContent = originalText;
    }
  }

  document.getElementById('btn-subscribe-monthly')?.addEventListener('click', () => handleSubscribe('MONTHLY'));
  document.getElementById('btn-subscribe-yearly')?.addEventListener('click', () => handleSubscribe('YEARLY'));
  document.getElementById('btn-subscribe-test')?.addEventListener('click', () => handleSubscribe('TEST'));

  document.getElementById('btn-cancel-subscription')?.addEventListener('click', async () => {
    const confirmed = await new Promise(resolve => {
      openModal({
        title: 'Cancelar suscripción',
        content: '<p>¿Estás seguro que querés cancelar? Podrás seguir usando PataSoft hasta el vencimiento del período actual.</p>',
        confirmText: 'Sí, cancelar',
        cancelText: 'Volver',
        onConfirm: () => resolve(true),
        onCancel: () => resolve(false),
      });
    });

    if (!confirmed) return;

    try {
      await api.post('/subscriptions/cancel');
      showToast('Suscripción cancelada', 'success');
      await renderSettingsSubscriptionContent(content, pageData);
    } catch (e) {
      showToast(e.message || 'Error al cancelar', 'error');
    }
  });

  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get('success') === 'true') {
    showToast('¡Pago recibido! Tu suscripción se activará en instantes.', 'success');
    history.replaceState(null, '', window.location.pathname);
  } else if (urlParams.get('error') === 'true') {
    showToast('El pago no pudo procesarse. Intenta nuevamente.', 'error');
    history.replaceState(null, '', window.location.pathname);
  }
}

async function renderSettingsMercadoPagoContent(content, pageData) {
  content.replaceChildren();
  const loadingEl = document.createElement('div');
  loadingEl.style.display = 'flex';
  loadingEl.style.justifyContent = 'center';
  loadingEl.style.padding = '40px';
  loadingEl.appendChild(createSpinner({ size: '40px' }));
  content.appendChild(loadingEl);
  
  try {
    const mpStatus = await api.get('/mercadopago/oauth/status').catch(() => ({ connected: false }));
    
    const isConnected = mpStatus.connected;
    
    content.replaceChildren();
    content.insertAdjacentHTML('beforeend', `
      <div class="settings-section">
        <h3>MercadoPago</h3>
        <p style="color: var(--text-secondary); font-size: var(--text-sm); margin-bottom: var(--space-4);">
          Conectá tu cuenta de MercadoPago para recibir pagos por QR y checkout online de tus clientes.
        </p>
        
        <div style="background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-lg); padding: var(--space-6); margin-bottom: var(--space-4); text-align: center;">
          ${isConnected ? `
            <div style="display: flex; flex-direction: column; align-items: center; gap: var(--space-3);">
              <div style="width: 60px; height: 60px; border-radius: 50%; background: rgba(16,185,129,0.1); display: flex; align-items: center; justify-content: center; font-size: 1.5rem;">✓</div>
              <div style="font-weight: 600; color: #065f46;">Cuenta conectada</div>
              ${mpStatus.nickname ? `<div style="font-size: var(--text-sm); color: var(--text-secondary);">@${escapeHtml(mpStatus.nickname)}</div>` : ''}
              <button class="btn btn-outline btn-sm" id="mp-disconnect-btn" style="margin-top: var(--space-2);">Desconectar</button>
            </div>
          ` : `
            <div style="display: flex; flex-direction: column; align-items: center; gap: var(--space-3);">
              <div style="width: 60px; height: 60px; border-radius: 50%; background: rgba(239,68,68,0.1); display: flex; align-items: center; justify-content: center; font-size: 1.5rem;">⚠</div>
              <div style="font-weight: 600; color: #991b1b;">Cuenta no conectada</div>
              <div style="font-size: var(--text-sm); color: var(--text-secondary);">Necesitás conectar tu cuenta para recibir pagos electrónicos.</div>
              <button class="btn btn-primary" id="mp-connect-btn" style="margin-top: var(--space-2);">
                Conectar con MercadoPago
              </button>
            </div>
          `}
        </div>
        
        ${isConnected ? `
          <div style="border-top: 1px solid var(--border); padding-top: var(--space-4); margin-top: var(--space-4);">
            <h4 style="font-size: var(--text-base); margin-bottom: var(--space-3);">Configuración avanzada</h4>
            <div class="form-group">
              <label class="form-label">Access Token</label>
              <input type="password" class="form-input" id="mp-access-token" value="${escapeHtml(mpStatus.accessTokenMasked || '')}" placeholder="Access Token">
            </div>
            <div class="form-group">
              <label class="form-label">Public Key</label>
              <input type="text" class="form-input" id="mp-public-key" value="${escapeHtml(mpStatus.publicKey || '')}" placeholder="Public Key">
            </div>
            <button class="btn btn-outline" id="save-mp-btn">Guardar manualmente</button>
          </div>
        ` : ''}
      </div>
    `);
    
    document.getElementById('mp-connect-btn')?.addEventListener('click', async () => {
      try {
        const { url } = await api.get('/mercadopago/oauth/connect');
        window.location.href = url;
      } catch (e) {
        showToast(e.message || 'Error al conectar con MercadoPago', 'error');
      }
    });

    document.getElementById('mp-disconnect-btn')?.addEventListener('click', async () => {
      const confirmed = await Modal.confirm('¿Desconectar tu cuenta de MercadoPago? No podrás recibir pagos electrónicos.');
      if (!confirmed) return;
      try {
        await api.delete('/mercadopago/oauth/disconnect');
        showToast('Cuenta desconectada', 'success');
        renderSettingsMercadoPagoContent(content, pageData);
      } catch (e) {
        showToast(e.message || 'Error desconectando', 'error');
      }
    });
    
    document.getElementById('save-mp-btn')?.addEventListener('click', async () => {
      try {
        await api.patch('/companies/me/config', {
          mpAccessToken: document.getElementById('mp-access-token').value,
          mpPublicKey: document.getElementById('mp-public-key').value,
        });
        showToast('Configuración guardada', 'success');
      } catch (e) {
        showToast(e.message || 'Error guardando', 'error');
      }
    });
    
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('connected') === 'true') {
      showToast('MercadoPago conectado exitosamente', 'success');
      history.replaceState(null, '', window.location.pathname);
    } else if (urlParams.get('error') === 'oauth_failed') {
      showToast('Error al conectar con MercadoPago', 'error');
      history.replaceState(null, '', window.location.pathname);
    }
  } catch (e) {
    content.replaceChildren();
    content.insertAdjacentHTML('beforeend', '<div class="empty-state" role="status"><p>Error cargando configuración de MercadoPago</p></div>');
  }
}

let priceItemsController = null;

export async function loadPriceItemsData(pageData, page = 1, search = '') {
  if (priceItemsController) priceItemsController.abort();
  priceItemsController = new AbortController();
  try {
    const params = { page, limit: 20 };
    if (search) params.search = search;
    
    const result = await api.get('/price-items', params, { signal: priceItemsController.signal });
    pageData.priceItems = { ...result, page, search };
  } catch (e) {
    if (e.name === 'AbortError') return;
    pageData.priceItems = { data: [], meta: { total: 0 }, page, search };
  }
}

export async function renderSettingsPricesContent(content, pageData) {
  const data = pageData.priceItems || { data: [], meta: { total: 0 } };
  
  content.replaceChildren();
  content.insertAdjacentHTML('beforeend', `
    <div class="page-header" style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;gap:12px;flex-wrap:wrap">
      <input type="text" class="form-input" id="prices-search" placeholder="Buscar precios..." value="${escapeHtml(pageData.priceItems?.search || '')}" style="flex:1;max-width:300px">
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <button class="btn btn-outline" id="download-prices-template-btn">📥 Plantilla</button>
        <button class="btn btn-outline" id="export-prices-btn">📤 Exportar</button>
        <button class="btn btn-outline" id="import-prices-btn">
          📂 Importar
          <input type="file" id="import-prices-input" accept=".xlsx,.xls" style="display:none">
        </button>
        <button class="btn btn-primary" id="add-price-btn">Nuevo Precio</button>
      </div>
    </div>
    <div id="prices-list"></div>
    <div id="prices-pagination"></div>
  `);
  
  const listEl = document.getElementById('prices-list');
  if (data.data?.length) {
    listEl.replaceChildren();
    listEl.insertAdjacentHTML('beforeend', `
      <table class="data-table">
        <thead><tr><th>Nombre</th><th>Categoría</th><th>Precio</th><th>Acciones</th></tr></thead>
        <tbody>${data.data.map(p => `
          <tr>
            <td>${escapeHtml(p.name)}</td>
            <td>${escapeHtml(p.category || '-')}</td>
            <td>${formatCurrency(p.price)}</td>
            <td>
              <button class="btn btn-outline btn-sm" data-id="${p.id}" data-action="edit-price">Editar</button>
              <button class="btn btn-danger btn-sm" data-id="${p.id}" data-action="delete-price">Eliminar</button>
            </td>
          </tr>
        `).join('')}</tbody>
      </table>
    `);
    
    listEl.querySelectorAll('[data-action="edit-price"]').forEach(btn => {
      btn.addEventListener('click', () => showPriceModal(btn.dataset.id, pageData));
    });
    listEl.querySelectorAll('[data-action="delete-price"]').forEach(btn => {
      btn.addEventListener('click', () => deletePriceItem(btn.dataset.id, pageData));
    });
  } else {
    listEl.replaceChildren();
    listEl.insertAdjacentHTML('beforeend', '<div class="empty-state" role="status"><p>No hay precios</p></div>');
  }
  
  if (data.meta?.totalPages > 1) {
    const pagEl = document.getElementById('prices-pagination');
    if (pagEl) {
      const pagination = createPagination({
        total: data.meta.total, page: data.page || 1, limit: 20,
        onPageChange: async (newPage) => {
          await loadPriceItemsData(pageData, newPage, pageData.priceItems?.search || '');
          renderSettingsPricesContent(content, pageData);
        }
      });
      pagEl.appendChild(pagination);
    }
  }
  
  document.getElementById('add-price-btn')?.addEventListener('click', () => showPriceModal(null, pageData));
  
  document.getElementById('download-prices-template-btn')?.addEventListener('click', async () => {
    try {
      const blob = await api.getBlob('/price-items/template');
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = 'plantilla-precios.xlsx'; a.click();
      URL.revokeObjectURL(url);
    } catch (e) { showToast('Error al descargar plantilla', 'error'); }
  });

  document.getElementById('export-prices-btn')?.addEventListener('click', async () => {
    try {
      const { url } = await api.get('/price-items/export');
      if (url) {
        window.open(url, '_blank');
        showToast('Lista de precios exportada', 'success');
      }
    } catch (e) { showToast('Error al exportar', 'error'); }
  });

  document.getElementById('import-prices-btn')?.addEventListener('click', () => {
    document.getElementById('import-prices-input')?.click();
  });

  document.getElementById('import-prices-input')?.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const formData = new FormData();
    formData.append('file', file);
    try {
      showToast('Importando precios...', 'info');
      const result = await api.postFormData('/price-items/import', formData);
      showToast(`✅ ${escapeHtml(result.imported)} precios importados correctamente`, 'success');
      if (result.errors?.length) {
        console.warn('Errores de importación:', result.errors);
        showToast(`⚠️ ${escapeHtml(result.errors.length)} filas con errores (ver consola)`, 'warning');
      }
      await loadPriceItemsData(pageData, 1, pageData.priceItems?.search || '');
      renderSettingsPricesContent(document.getElementById('settings-content'), pageData);
    } catch (e) { showToast(e.message || 'Error al importar', 'error'); }
    e.target.value = '';
  });

  document.getElementById('prices-search')?.addEventListener('input', debounce(async (e) => {
    await loadPriceItemsData(pageData, 1, e.target.value);
    renderSettingsPricesContent(content, pageData);
  }, 400));
}

export function showPriceModal(itemId, pageData) {
  const isEdit = !!itemId;
  const item = isEdit ? pageData.priceItems?.data?.find(p => p.id === itemId) : null;
  
  openModal({
    title: isEdit ? 'Editar Precio' : 'Nuevo Precio',
    content: `
      <div class="form-group">
        <label class="form-label required">Nombre</label>
        <input type="text" class="form-input" id="price-name" value="${escapeHtml(item?.name || '')}">
      </div>
      <div class="form-group">
        <label class="form-label">Categoría</label>
        <input type="text" class="form-input" id="price-category" value="${escapeHtml(item?.category || '')}">
      </div>
      <div class="form-group">
        <label class="form-label required">Precio</label>
        <input type="number" class="form-input" id="price-value" step="0.01" value="${escapeHtml(item?.price || '')}">
      </div>
      <div class="form-group">
        <label class="form-label">Descripción</label>
        <textarea class="form-input" id="price-desc" rows="2">${escapeHtml(item?.description || '')}</textarea>
      </div>
    `,
    confirmText: isEdit ? 'Guardar' : 'Crear',
    onConfirm: async () => {
      document.querySelectorAll('.field-error').forEach(el => el.remove());
      document.querySelectorAll('.input-error').forEach(el => el.classList.remove('input-error'));
      const name = document.getElementById('price-name').value.trim();
      const price = parseFloat(document.getElementById('price-value').value);
      
      let hasError = false;
      if (!name) { showFieldError('price-name', 'El nombre es requerido'); hasError = true; }
      if (!price || price <= 0) { showFieldError('price-value', 'El precio es requerido'); hasError = true; }
      if (hasError) return false;
      
      try {
        const payload = {
          name,
          category: document.getElementById('price-category').value.trim(),
          price,
          description: document.getElementById('price-desc').value.trim(),
        };
        
        if (isEdit) {
          await api.patch(`/price-items/${itemId}`, payload);
          showToast('Precio actualizado', 'success');
        } else {
          await api.post('/price-items', payload);
          showToast('Precio creado', 'success');
        }
        
        await loadPriceItemsData(pageData, pageData.priceItems?.page || 1, pageData.priceItems?.search || '');
        renderSettingsPricesContent(document.getElementById('settings-content'), pageData);
      } catch (e) {
        showToast(e.message || 'Error guardando precio', 'error');
        return false;
      }
    }
  });
}

export async function deletePriceItem(itemId, pageData) {
  const confirmed = await Modal.confirm('¿Estás seguro de eliminar este precio?');
  if (!confirmed) return;
  
  try {
    await api.delete(`/price-items/${itemId}`);
    showToast('Precio eliminado', 'success');
    await loadPriceItemsData(pageData, pageData.priceItems?.page || 1, pageData.priceItems?.search || '');
    renderSettingsPricesContent(document.getElementById('settings-content'), pageData);
  } catch (e) {
    showToast(e.message || 'Error eliminando precio', 'error');
  }
}

async function renderSettingsAIContent(content, pageData) {
  try {
    const [config, ragStatus] = await Promise.all([
      api.get('/companies/me/config').catch(() => ({})),
      api.get('/ai/rag/status').catch(() => ({ synced: false, documentsCount: 0 }))
    ]);
    
    content.replaceChildren();
    content.insertAdjacentHTML('beforeend', `
      <div class="settings-section">
        <h3>Configuración de IA</h3>
        <div class="form-group">
          <label class="form-label">Modelo predeterminado</label>
          <select class="form-input" id="ai-model">
            <option value="llama-3.3-70b-versatile" ${config?.defaultAIModel === 'llama-3.3-70b-versatile' ? 'selected' : ''}>Llama 3.3 (Groq)</option>
            <option value="gpt-4o" ${config?.defaultAIModel === 'gpt-4o' ? 'selected' : ''}>GPT-4o (OpenAI)</option>
            <option value="gemini-1.5-flash" ${config?.defaultAIModel === 'gemini-1.5-flash' ? 'selected' : ''}>Gemini (Google)</option>
          </select>
        </div>
        <button class="btn btn-primary" id="save-ai-btn">Guardar</button>
      </div>

      <div class="settings-section" style="margin-top: var(--space-6);">
        <h3>Base de Conocimiento (RAG)</h3>
        
        <div style="background: var(--bg); border-radius: var(--radius-lg); padding: var(--space-4); margin-bottom: var(--space-4);">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <div>
              <span style="font-weight: 600;">Estado del RAG</span>
              <span class="badge ${ragStatus?.documentsCount > 0 ? 'badge-success' : 'badge-warning'}" style="margin-left: var(--space-2);">
                ${escapeHtml(ragStatus?.documentsCount || 0)} documentos
              </span>
            </div>
            <button class="btn btn-outline btn-sm" id="sync-rag-btn">🔄 Sincronizar datos</button>
          </div>
          <p style="font-size: var(--text-xs); color: var(--text-secondary); margin-top: var(--space-2);">
            Sincronizá clientes, mascotas, insumos e historiales médicos desde tu base de datos.
          </p>
        </div>

        <p style="color: var(--text-secondary); font-size: var(--text-sm); margin-bottom: var(--space-4);">
          Cargá documentos PDF o TXT para que la IA pueda responder preguntas sobre el contenido de tus archivos.
        </p>
        <div style="border: 2px dashed var(--border); border-radius: var(--radius-lg); padding: var(--space-6); text-align: center;">
          <input type="file" id="rag-file-input" accept=".pdf,.txt" style="display: none;">
          <button class="btn btn-outline" id="upload-rag-btn">📄 Subir documento</button>
          <p style="font-size: var(--text-xs); color: var(--text-secondary); margin-top: var(--space-2);">
            Formatos admitidos: PDF, TXT (máx 10MB)
          </p>
        </div>
        <div id="rag-files-list" style="margin-top: var(--space-4);"></div>
      </div>
    `);
    
    document.getElementById('save-ai-btn').addEventListener('click', async () => {
      try {
        await api.patch('/companies/me/config', {
          defaultAIModel: document.getElementById('ai-model').value,
        });
        showToast('Configuración guardada', 'success');
      } catch (e) {
        showToast(e.message || 'Error guardando', 'error');
      }
    });

    document.getElementById('upload-rag-btn')?.addEventListener('click', () => {
      document.getElementById('rag-file-input')?.click();
    });

    document.getElementById('rag-file-input')?.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      
      const formData = new FormData();
      formData.append('file', file);
      
      try {
        showToast('Subiendo documento...', 'info');
        await api.post('/ai/rag/upload', formData);
        showToast('Documento subido correctamente', 'success');
        e.target.value = '';
      } catch (err) {
        showToast(err.message || 'Error al subir documento', 'error');
      }
    });

    document.getElementById('sync-rag-btn')?.addEventListener('click', async () => {
      const btn = document.getElementById('sync-rag-btn');
      btn.disabled = true;
      btn.textContent = 'Sincronizando...';
      try {
        showToast('Sincronizando datos con el RAG...', 'info');
        const result = await api.post('/ai/rag/sync');
        const ing = result.ingested || {};
        showToast(`✅ Sincronizado: ${escapeHtml(ing.clients || 0)} clientes, ${escapeHtml(ing.pets || 0)} mascotas, ${escapeHtml(ing.supplies || 0)} insumos`, 'success');
      } catch (err) {
        showToast(err.message || 'Error al sincronizar', 'error');
      } finally {
        btn.disabled = false;
        btn.textContent = '🔄 Sincronizar datos';
      }
    });
  } catch (e) {
    content.replaceChildren();
    content.insertAdjacentHTML('beforeend', '<div class="empty-state" role="status"><p>Error cargando configuración</p></div>');
  }
}

async function renderSettingsConnectionsContent(content, pageData) {
  const data = pageData.settingsConnections || { data: [], meta: { total: 0 } };
  
  content.replaceChildren();
  content.insertAdjacentHTML('beforeend', `
    <div class="page-header">
      <button class="btn btn-primary" id="request-connection-btn">Solicitar Conexión</button>
    </div>
    <div id="connections-list"></div>
  `);
  
  const listEl = document.getElementById('connections-list');
  if (data.data?.length) {
    listEl.replaceChildren();
    listEl.insertAdjacentHTML('beforeend', `
      <table class="data-table">
        <thead><tr><th>Veterinaria</th><th>Estado</th><th>Acciones</th></tr></thead>
        <tbody>${data.data.map(c => `
          <tr>
            <td>${escapeHtml(c.company?.name || '-')}</td>
            <td><span class="badge badge-${c.status === 'ACCEPTED' ? 'success' : 'warning'}">${formatStatus(c.status, 'connection')}</span></td>
            <td>
              ${c.status === 'PENDING' ? `<button class="btn btn-outline btn-sm" data-id="${c.id}" data-action="accept">Aceptar</button>` : ''}
            </td>
          </tr>
        `).join('')}</tbody>
      </table>
    `);

    listEl.querySelectorAll('[data-action="accept"]').forEach(btn => {
      btn.addEventListener('click', async () => {
        try {
          await api.patch(`/connections/${btn.dataset.id}`, { status: 'ACCEPTED' });
          showToast('Conexión aceptada', 'success');
          await loadConnectionsData(pageData.settingsConnections?.page || 1, '');
          renderSettingsConnectionsContent(document.getElementById('settings-content'), pageData);
        } catch (e) {
          showToast(e.message || 'Error', 'error');
        }
      });
    });
  } else {
    listEl.replaceChildren();
    listEl.insertAdjacentHTML('beforeend', '<div class="empty-state" role="status"><p>No hay conexiones</p></div>');
  }

  document.getElementById('request-connection-btn')?.addEventListener('click', () => {
    openModal({
      title: 'Solicitar Conexión con otra Clínica',
      content: `
        <div class="form-group">
          <label class="form-label">Buscar empresa por nombre o email</label>
          <input type="text" class="form-input" id="search-company-input" placeholder="Buscar...">
        </div>
        <div id="company-search-results"></div>
      `,
      confirmText: null,
      cancelText: 'Cerrar',
    });

    let searchTimeout;
    let companySearchController = null;
    document.getElementById('search-company-input')?.addEventListener('input', (e) => {
      clearTimeout(searchTimeout);
      const q = e.target.value.trim();
      if (q.length < 2) return;
      searchTimeout = setTimeout(async () => {
        if (companySearchController) companySearchController.abort();
        companySearchController = new AbortController();
        const resultsEl = document.getElementById('company-search-results');
        if (!resultsEl) return;
        resultsEl.replaceChildren();
        resultsEl.insertAdjacentHTML('beforeend', 'Buscando...');
        try {
          const companies = await api.get(`/companies/search?q=${encodeURIComponent(q)}`, {}, { signal: companySearchController.signal });
          if (!companies?.length) {
            resultsEl.replaceChildren();
            resultsEl.insertAdjacentHTML('beforeend', 'No se encontraron empresas.');
            return;
          }
          resultsEl.replaceChildren();
          resultsEl.insertAdjacentHTML('beforeend', companies.map(c => `
            <div style="padding: 8px; border-bottom: 1px solid var(--border); display: flex; justify-content: space-between; align-items: center;">
              <div>
                <strong>${escapeHtml(c.name)}</strong>
                ${c.email ? `<br><small>${escapeHtml(c.email)}</small>` : ''}
              </div>
              <button class="btn btn-outline btn-sm" data-company-id="${escapeHtml(c.id)}" data-company-name="${escapeHtml(c.name)}">Conectar</button>
            </div>
          `).join(''));
          resultsEl.querySelectorAll('button[data-company-id]').forEach(btn => {
            btn.addEventListener('click', async () => {
              btn.disabled = true;
              btn.textContent = 'Enviando...';
              try {
                await api.post('/connections', { companyBId: btn.dataset.companyId });
                showToast(`Solicitud enviada a ${btn.dataset.companyName}`, 'success');
                closeModal();
                await loadConnectionsData(pageData.settingsConnections?.page || 1, '');
                renderSettingsConnectionsContent(document.getElementById('settings-content'), pageData);
              } catch (e) {
                showToast(e.message || 'Error al enviar solicitud', 'error');
                btn.disabled = false;
                btn.textContent = 'Conectar';
              }
            });
          });
        } catch (e) {
          if (e.name === 'AbortError') return;
          resultsEl.replaceChildren();
          resultsEl.insertAdjacentHTML('beforeend', `Error: ${escapeHtml(e.message)}`);
        }
      }, 400);
    });
  });
}

async function loadConnectionsData(page, status) {
  // Placeholder - will be implemented in connections module
}

async function renderExportDataContent(content, pageData) {
  content.replaceChildren();
  content.insertAdjacentHTML('beforeend', `
    <div class="settings-section">
      <h3>Exportar Datos</h3>
      <p style="color: var(--text-secondary); font-size: var(--text-sm); margin-bottom: var(--space-4);">
        Exportá todos los datos de tu veterinaria en formato Excel.
      </p>
      <button class="btn btn-primary" id="export-all-btn">📥 Exportar todo</button>
    </div>
  `);
  
  document.getElementById('export-all-btn')?.addEventListener('click', async () => {
    try {
      showToast('Generando exportación...', 'info');
      const blob = await api.getBlob('/export/all');
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `patasoft-export-${new Date().toISOString().split('T')[0]}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
      showToast('Exportación completada', 'success');
    } catch (e) {
      showToast(e.message || 'Error exportando datos', 'error');
    }
  });
}
