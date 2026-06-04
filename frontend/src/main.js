import { router } from './router.js';
import { isAuthenticated, loadFromStorage, getCompany } from './stores/auth.store.js';
import { connect, disconnect } from './services/socket.js';
import { api } from './services/api.js';
import { showBlockedFullScreen, showBlockedBanner } from './utils/ui.js';

import { renderLogin, renderRegister, renderAuthCallback } from './pages/auth.js';
import { renderDashboard, renderDashboardHome } from './pages/dashboard.js';

const PUBLIC_ROUTES = ['/login', '/register', '/onboarding', '/auth/callback'];
const AUTH_ROUTES = ['/dashboard', '/settings', '/admin', '/api/v1/auth/google'];
const ALLOWED_BLOCKED_ROUTES = ['/settings/subscription', '/settings/export-data'];

router.register('/login', { render: renderLogin, public: true });
router.register('/register', { render: renderRegister, public: true });
router.register('/auth/callback', { render: renderAuthCallback, public: true });
router.register('/onboarding', { render: () => import('./pages/onboarding.js').then(m => m.renderOnboarding()), public: true });
router.register('/', { render: renderDashboardHome });
router.register('/dashboard', { render: renderDashboard });
router.register('/dashboard/home', { render: renderDashboardHome });
router.register('/dashboard/clients', { render: () => import('./pages/dashboard.js').then(m => m.renderClients()) });
router.register('/dashboard/pets', { render: () => import('./pages/dashboard.js').then(m => m.renderPets()) });
router.register('/dashboard/medical-records', { render: () => import('./pages/dashboard.js').then(m => m.renderMedicalRecords()) });
router.register('/dashboard/payments', { render: () => import('./pages/dashboard.js').then(m => m.renderPayments()) });
router.register('/dashboard/supplies', { render: () => import('./pages/dashboard.js').then(m => m.renderSupplies()) });
router.register('/dashboard/ai-chat', { render: () => import('./pages/dashboard.js').then(m => m.renderAIChat()) });
router.register('/dashboard/cash-register', { render: () => import('./pages/dashboard.js').then(m => m.renderCashRegister()) });
router.register('/dashboard/connections', { render: () => import('./pages/dashboard.js').then(m => m.renderConnections()) });
router.register('/dashboard/documents', { render: () => import('./pages/dashboard.js').then(m => m.renderDocuments()) });
router.register('/settings', { render: () => import('./pages/dashboard.js').then(m => m.renderSettings()) });
router.register('/settings/company', { render: () => import('./pages/dashboard.js').then(m => m.renderSettingsCompany()) });
router.register('/settings/subscription', { 
  render: async () => {
    const params = new URLSearchParams(window.location.search);
    const status = params.get('status');
    if (status === 'success') {
      // Limpiar la URL sin recargar
      window.history.replaceState({}, '', '/settings/subscription');
      // Mostrar toast o banner de éxito
      setTimeout(() => {
        const toast = document.createElement('div');
        toast.style = 'position:fixed;top:24px;right:24px;background:#22c55e;color:white;padding:16px 24px;border-radius:8px;font-weight:600;z-index:9999;';
        toast.textContent = '✓ Suscripción activada exitosamente';
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 4000);
      }, 500);
    }
    return import('./pages/dashboard.js').then(m => m.renderSettingsSubscription());
  }
});
router.register('/settings/mercadopago', { render: () => import('./pages/dashboard.js').then(m => m.renderSettingsMercadoPago()) });
router.register('/settings/prices', { render: () => import('./pages/dashboard.js').then(m => m.renderSettingsPrices()) });
router.register('/settings/ai', { render: () => import('./pages/dashboard.js').then(m => m.renderSettingsAI()) });
router.register('/settings/connections', { render: () => import('./pages/dashboard.js').then(m => m.renderSettingsConnections()) });
router.register('/settings/export-data', {
  render: () => import('./pages/dashboard.js').then(m => m.renderExportData())
});
router.register('/admin', { render: () => import('./pages/admin.js').then(m => m.renderAdmin()) });
router.register('/superadmin/subscriptions', { render: () => import('./pages/dashboard.js').then(m => m.renderSuperAdminSubscriptions()) });

function checkAuth(pathname) {
  if (PUBLIC_ROUTES.includes(pathname)) {
    return true;
  }

  if (pathname.startsWith('/settings') || pathname.startsWith('/dashboard') || pathname.startsWith('/admin')) {
    return isAuthenticated();
  }

  return true;
}

function getDefaultRoute(pathname) {
  if (pathname === '/' || pathname === '') {
    return isAuthenticated() ? '/dashboard/home' : '/login';
  }

  if (pathname === '/dashboard') {
    return '/dashboard/home';
  }

  if (pathname === '/settings') {
    return '/settings/company';
  }

  return null;
}

window._router = router;

async function initApp() {
  const pathname = location.pathname;

  loadFromStorage();

  const params = new URLSearchParams(location.search);
  const token = params.get('token');
  const refresh = params.get('refresh');
  if (token && refresh) {
    api.setToken(token, refresh);
    window.history.replaceState({}, '', pathname);
  }

  // Verificar bloqueo al cargar
  if (isAuthenticated()) {
    try {
      const company = await api.get('/companies/me');
      if (company?.isBlocked) {
        if (ALLOWED_BLOCKED_ROUTES.includes(pathname)) {
          showBlockedBanner(company.blockedReason || 'Tu suscripción ha vencido.');
        } else {
          showBlockedFullScreen(company.blockedReason || 'Tu suscripción ha vencido.');
          return;
        }
      }
    } catch(e) {}
  }

  if (!checkAuth(pathname)) {
    history.replaceState(null, '', '/login');
    router.navigate('/login', false);
    return;
  }

  const defaultRoute = getDefaultRoute(pathname);
  if (defaultRoute && defaultRoute !== pathname) {
    router.navigate(defaultRoute, false);
    return;
  }

  if (isAuthenticated()) {
    const company = getCompany();
    if (company) {
      connect();
    } else {
      const isGoingToDashboard = pathname.startsWith('/dashboard') || 
                                  pathname.startsWith('/settings') ||
                                  pathname === '/';
      if (isGoingToDashboard) {
        try {
          const user = await api.get('/auth/me');
          if (user && !user.companyId) {
            router.navigate('/onboarding', false);
            return;
          }
        } catch (err) {
          if (err.message === 'ONBOARDING_REQUIRED' || err.message.includes('empresa')) {
            router.navigate('/onboarding', false);
            return;
          }
        }
      }
    }
  }

  window.addEventListener('popstate', () => router.navigate(location.pathname, false));
  await router.navigate(pathname, false);
}

document.addEventListener('DOMContentLoaded', initApp);

window.addEventListener('beforeunload', () => {
  disconnect();
});

window.addEventListener('error', (event) => {
  console.error('[Global Error]', event.error || event.message);
  if (!event.defaultPrevented) {
    const msg = event.error?.message || event.message || 'Error inesperado';
    import('./components/Toast.js').then(({ Toast }) => {
      Toast.error(msg);
    });
  }
});

window.addEventListener('unhandledrejection', (event) => {
  console.error('[Unhandled Rejection]', event.reason);
  const msg = event.reason?.message || 'Error inesperado';
  import('./components/Toast.js').then(({ Toast }) => {
    Toast.error(msg);
  });
});