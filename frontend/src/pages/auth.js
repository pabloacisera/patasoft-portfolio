import { api } from '../services/api.js';
import { isAuthenticated } from '../stores/auth.store.js';
import { router } from '../router.js';
import { renderDashboard } from './dashboard.js';

export function renderLogin() {
  const app = document.getElementById('app');
  
  app.innerHTML = renderAuthLayout(`
    <div class="auth-page">
      <div class="auth-side">
        <div class="auth-card">
          <h1 class="auth-title">PataSoft</h1>
          <p class="auth-subtitle">Gestión Veterinaria</p>
          
          <form id="login-form">
            <div class="form-group">
              <label for="email" class="form-label required">Email</label>
              <input type="email" id="email" class="form-input" required placeholder="veterinaria@email.com">
            </div>
            
            <div class="form-group">
              <label for="password" class="form-label required">Contraseña</label>
              <input type="password" id="password" class="form-input" required placeholder="••••••••">
            </div>
            
            <div id="login-error" class="form-error hidden"></div>
            
            <button type="submit" class="btn btn-primary w-full">Iniciar Sesión</button>
          </form>
          
          <div class="auth-divider">
            <span>o</span>
          </div>
          
          <button id="google-btn" class="btn btn-outline w-full">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            Continuar con Google
          </button>
          
          <p class="auth-footer">
            ¿No tenés cuenta? <a href="/register">Registrate</a>
          </p>
        </div>
      </div>
    </div>
  `);
  
  document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const errorEl = document.getElementById('login-error');
    const btn = e.target.querySelector('button[type="submit"]');
    
    btn.disabled = true;
    btn.textContent = 'Cargando...';
    
    try {
      const data = await api.post('/auth/login', { email, password });
      api.setToken(data.accessToken, data.refreshToken);
      router.navigate('/dashboard');
    } catch (err) {
      errorEl.textContent = err.message || 'Error al iniciar sesión';
      errorEl.classList.remove('hidden');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Iniciar Sesión';
    }
  });
  
  document.getElementById('google-btn').addEventListener('click', () => {
    window.location.href = '/api/v1/auth/google';
  });
}

export function renderRegister() {
  const app = document.getElementById('app');
  
  app.innerHTML = renderAuthLayout(`
    <div class="auth-page">
      <div class="auth-side">
        <div class="auth-card">
          <h1 class="auth-title">Crear Cuenta</h1>
          
          <div style="background: rgba(245,158,11,0.1); border: 1px solid rgba(245,158,11,0.3); border-radius: var(--radius-lg); padding: var(--space-4); margin-bottom: var(--space-6);">
            <div style="font-size: 1.5rem; margin-bottom: var(--space-2);">🎉 72 horas de prueba gratuita</div>
            <ul style="list-style: none; padding: 0; margin: 0; font-size: var(--text-sm); color: #92400e;">
              <li style="margin-bottom: 4px;">✓ Acceso completo a todas las funciones</li>
              <li style="margin-bottom: 4px;">✓ Sin tarjeta de crédito requerida</li>
              <li>✓ Luego podés elegir plan mensual ($5.000/mes) o anual ($50.000/año)</li>
            </ul>
          </div>
          
          <form id="register-form">
            <div class="form-group">
              <label for="name" class="form-label required">Nombre</label>
              <input type="text" id="name" class="form-input" required placeholder="Juan Pérez">
            </div>
            
            <div class="form-group">
              <label for="email" class="form-label required">Email</label>
              <input type="email" id="email" class="form-input" required placeholder="veterinaria@email.com">
            </div>
            
            <div class="form-group">
              <label for="password" class="form-label required">Contraseña</label>
              <input type="password" id="password" class="form-input" required minlength="6" placeholder="••••••••">
            </div>
            
            <div id="register-error" class="form-error hidden"></div>
            
            <button type="submit" class="btn btn-primary w-full">Crear Cuenta</button>
          </form>
          
          <p class="auth-footer">
            ¿Ya tenés cuenta? <a href="/login">Iniciar Sesión</a>
          </p>
        </div>
      </div>
    </div>
  `);
  
  document.getElementById('register-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('name').value;
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const errorEl = document.getElementById('register-error');
    const btn = e.target.querySelector('button[type="submit"]');
    
    btn.disabled = true;
    btn.textContent = 'Creando cuenta...';
    
    try {
      const data = await api.post('/auth/register', { name, email, password });
      api.setToken(data.accessToken, data.refreshToken);
      router.navigate('/onboarding');
    } catch (err) {
      errorEl.textContent = err.message || 'Error al registrarse';
      errorEl.classList.remove('hidden');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Crear Cuenta';
    }
  });
}

export function renderAuthLayout(content) {
  return `
    <style>
      .auth-page { min-height: 100vh; display: flex; align-items: stretch; }
      .auth-side { flex: 1; display: flex; align-items: center; justify-content: center; padding: var(--space-8) var(--space-6); background: var(--bg); min-height: 100vh; }
      .auth-card { width: 100%; max-width: 420px; background: var(--surface); border-radius: var(--radius-xl); box-shadow: var(--shadow-md); padding: var(--space-10) var(--space-8); border: 1px solid var(--border); }
      .auth-title { font-family: var(--font-display); font-size: var(--text-3xl); color: var(--color-forest); margin-bottom: var(--space-1); letter-spacing: -0.02em; }
      .auth-subtitle { color: var(--text-secondary); font-size: var(--text-sm); margin-bottom: var(--space-8); }
      .auth-divider { display: flex; align-items: center; margin: var(--space-5) 0; color: var(--text-secondary); }
      .auth-divider::before, .auth-divider::after { content: ''; flex: 1; height: 1px; background: var(--border); }
      .auth-divider span { padding: 0 var(--space-4); }
      .auth-footer { text-align: center; margin-top: var(--space-6); font-size: var(--text-sm); color: var(--text-secondary); }
      .w-full { width: 100%; }
    </style>
    ${content}
  `;
}

export function renderAuthCallback() {
  const params = new URLSearchParams(window.location.search);
  const token = params.get('token');
  const refresh = params.get('refresh');
  const needsCompany = params.get('needsCompany');

  console.log('[AuthCallback] Params recibidos:', { 
    token: token ? token.substring(0, 20) + '...' : null, 
    refresh: refresh ? 'presente' : null,
    needsCompany,
    fullUrl: window.location.href
  });

  if (token && refresh) {
    api.setToken(token, refresh);
    console.log('[AuthCallback] Tokens guardados, isAuthenticated:', isAuthenticated());
    
    // Si no tiene empresa, redirigir a onboarding
    if (needsCompany === 'true') {
      console.log('[AuthCallback] Usuario necesita crear empresa, redirigiendo a onboarding');
      router.navigate('/onboarding');
      return;
    }
    
    router.navigate('/dashboard');
  } else {
    console.warn('[AuthCallback] No se recibieron tokens, volviendo al login');
    router.navigate('/login');
  }
}