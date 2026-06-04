import { api } from '../../services/api.js';
import { formatCurrency, formatDate } from '../../utils/formatters.js';

export async function loadHomeData(pageData) {
  try {
    const [clients, pets, debts, supplies, subStatus] = await Promise.all([
      api.get('/clients').catch(() => ({ data: [], meta: { total: 0 } })),
      api.get('/pets').catch(() => ({ data: [], meta: { total: 0 } })),
      api.get('/debts?status=PENDING').catch(() => ({ data: [] })),
      api.get('/supplies/low-stock').catch(() => ({ data: [] })),
      api.get('/subscriptions/status').catch(() => null),
    ]);
    
    const totalDebt = (debts.data || []).reduce((sum, d) => sum + (d.amount || 0), 0);
    
    pageData.home = { clients, pets, totalDebt, lowStockCount: supplies.data?.length || 0, medicalRecords: pets.data || [], subStatus };
  } catch (e) {
    console.error('Error loading home data:', e);
  }
}

export async function renderHomePage(content, pageData) {
  const data = pageData.home || {};
  const clientsCount = data.clients?.meta?.total || data.clients?.data?.length || 0;
  const petsCount = data.pets?.meta?.total || data.pets?.data?.length || 0;
  const totalDebt = data.totalDebt || 0;
  const lowStockCount = data.lowStockCount || 0;
  const sub = data.subStatus;
  
  const isTrial = sub?.status === 'TRIAL';
  const isExpired = ['EXPIRED', 'BLOCKED', 'CANCELLED'].includes(sub?.status);
  const subBadge = isTrial ? 'badge-trial' : isExpired ? 'badge-expired' : 'badge-active';
  const subText = isTrial ? '⏳ Prueba gratuita' : isExpired ? '🔒 Vencida' : '✅ Activa';
  const subLink = isExpired || isTrial;
  
  content.innerHTML = `
    ${sub ? `
    <div class="subscription-card" style="background: var(--surface); border: 1.5px solid var(--border); border-radius: var(--radius-xl); padding: var(--space-4); margin-bottom: var(--space-6); display: flex; align-items: center; justify-content: space-between;">
      <div>
        <span class="subscription-badge ${subBadge}" style="display: inline-flex; align-items: center; gap: var(--space-2); padding: var(--space-1) var(--space-3); border-radius: var(--radius-full); font-size: var(--text-sm); font-weight: 600;">
          ${subText}
        </span>
        <span style="margin-left: var(--space-3); font-size: var(--text-sm); color: var(--text-secondary);">
          ${sub?.plan ? `Plan ${sub.plan === 'MONTHLY' ? 'Mensual' : 'Anual'}` : ''}
        </span>
      </div>
      ${subLink ? `<a href="/settings/subscription" class="btn btn-primary btn-sm">Ver planes</a>` : ''}
    </div>
    ` : ''}
    <div class="stats-grid">
      <div class="stat-card" onclick="window.location.href='/dashboard/clients'" style="cursor:pointer">
        <div class="stat-card-value">${clientsCount}</div>
        <div class="stat-card-label">Clientes</div>
      </div>
      <div class="stat-card" onclick="window.location.href='/dashboard/pets'" style="cursor:pointer">
        <div class="stat-card-value">${petsCount}</div>
        <div class="stat-card-label">Mascotas</div>
      </div>
      <div class="stat-card" onclick="window.location.href='/dashboard/payments'" style="cursor:pointer">
        <div class="stat-card-value">${formatCurrency(totalDebt)}</div>
        <div class="stat-card-label">Deuda Total</div>
      </div>
      <div class="stat-card" onclick="window.location.href='/dashboard/supplies'" style="cursor:pointer">
        <div class="stat-card-value">${lowStockCount}</div>
        <div class="stat-card-label">Insumos Bajos</div>
      </div>
    </div>
    
    <div style="margin-top: 24px;">
      <h3 style="margin-bottom: 16px;">Últimas Consultas</h3>
      <div class="empty-state" id="recent-records">
        <p>Cargando...</p>
      </div>
    </div>
  `;
  
  try {
    const { data: records } = await api.get('/medical-records?page=1&limit=5');
    const recordsEl = document.getElementById('recent-records');
    
    if (records?.length) {
      recordsEl.innerHTML = `
        <table class="data-table">
          <thead><tr><th>Fecha</th><th>Mascota</th><th>Motivo</th><th>Diagnóstico</th></tr></thead>
          <tbody>${records.map(r => `
            <tr>
              <td>${formatDate(r.date)}</td>
              <td>${r.pet?.name || '-'}</td>
              <td>${r.visitReason}</td>
              <td>${r.diagnosis || '-'}</td>
            </tr>
          `).join('')}</tbody>
        </table>
      `;
    } else {
      recordsEl.innerHTML = '<p class="empty-state">No hay consultas recientes</p>';
    }
  } catch (e) {
    document.getElementById('recent-records').innerHTML = '<p class="empty-state">Error cargando datos</p>';
  }
}
