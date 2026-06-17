import { api } from '../../services/api.js';
import { router } from '../../router.js';

export async function renderSuperAdminSubscriptions(pageData) {
  const content = document.getElementById('page-content');
  if (!content) return;
  
  try {
    const subs = await api.get('/superadmin/subscriptions');
    content.replaceChildren();
    content.insertAdjacentHTML('beforeend', `
      <div class="page-header"><h2>Administracion de Suscripciones</h2></div>
      <table class="data-table">
        <thead><tr><th>Empresa</th><th>Estado</th><th>Plan</th><th>Vence</th></tr></thead>
        <tbody>${(subs || []).map(s => '<tr><td>' + (s.company?.name || s.companyId) + '</td><td>' + s.status + '</td><td>' + (s.plan || '-') + '</td><td>' + (s.trialEndsAt ? new Date(s.trialEndsAt).toLocaleDateString() : '-') + '</td></tr>').join('')}</tbody>
      </table>`);
  } catch (e) {
    content.replaceChildren();
    content.insertAdjacentHTML('beforeend', '<div class="empty-state" role="status"><p>Error cargando datos: ' + e.message + '</p></div>');
  }
}
