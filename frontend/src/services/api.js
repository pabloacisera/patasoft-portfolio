import { getToken, getRefreshToken, setToken, logout } from '../stores/auth.store.js';

const API_BASE = '/api/v1';
const EXCLUDED_PATHS = ['/auth/login', '/auth/register', '/auth/refresh'];
const DEBUG = import.meta.env.DEV;

class ApiClient {
  constructor() {
    this.baseUrl = API_BASE;
    this.isRefreshing = false;
    this.pendingRequests = [];
  }

  getToken() {
    return getToken();
  }

  async request(endpoint, options = {}, retryCount = 0) {
    const url = `${this.baseUrl}${endpoint}`;
    const token = this.getToken();
    
    if (DEBUG) console.log('[API] Request:', endpoint, 'token:', token ? token.substring(0, 20) + '...' : null);
    
    const headers = {
      ...options.headers,
    };

    if (!(options.body instanceof FormData)) {
      headers['Content-Type'] = 'application/json';
    }

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (response.status === 401 && retryCount < 1) {
      const isAuthEndpoint = EXCLUDED_PATHS.some(path => endpoint.startsWith(path));
      
      if (isAuthEndpoint) {
        let authMessage = 'Unauthorized';
        try {
          const data = await response.clone().json();
          authMessage = data.message || authMessage;
        } catch {}
        throw new Error(authMessage);
      }
      
      const refreshed = await this.refreshToken();
      
      if (refreshed) {
        return this.request(endpoint, options, retryCount + 1);
      }
      
      logout();
      throw new Error('Unauthorized');
    }

    if (!response.ok) {
      let message = 'Request failed';
      let errorCode = null;
      try {
        const data = await response.json();
        message = data.message || message;
        errorCode = data.error || null;
      } catch {}

      if (response.status === 403 && (errorCode === 'ONBOARDING_REQUIRED' || message.includes('empresa'))) {
        // NO redirigir si ya estamos en onboarding (evita loop infinito)
        if (!window.location.pathname.startsWith('/onboarding')) {
          console.warn('[API] Usuario sin empresa, redirigiendo a onboarding...');
          const { router } = await import('../router.js');
          router.navigate('/onboarding');
        }
        throw new Error('ONBOARDING_REQUIRED');
      }

      console.error('[API] Response error:', response.status, message);
      throw new Error(message);
    }

    let data = null;
    const contentType = response.headers.get('content-type');
    const text = await response.text();
    if (text && text.length > 0) {
      try {
        data = JSON.parse(text);
      } catch (e) {
        console.warn('[API] Response no es JSON válido:', endpoint, text.substring(0, 100));
        data = null;
      }
    }
    if (DEBUG) console.log('[API] Response:', endpoint, data);
    
    return data;
  }

  async requestRaw(endpoint, options = {}, retryCount = 0) {
    const url = `${this.baseUrl}${endpoint}`;
    const token = this.getToken();

    const headers = {
      ...options.headers,
    };

    if (!(options.body instanceof FormData)) {
      headers['Content-Type'] = 'application/json';
    }

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (response.status === 401 && retryCount < 1) {
      const isAuthEndpoint = EXCLUDED_PATHS.some(path => endpoint.startsWith(path));

      if (isAuthEndpoint) {
        let authMessage = 'Unauthorized';
        try {
          const data = await response.clone().json();
          authMessage = data.message || authMessage;
        } catch {}
        throw new Error(authMessage);
      }

      const refreshed = await this.refreshToken();

      if (refreshed) {
        return this.requestRaw(endpoint, options, retryCount + 1);
      }

      logout();
      throw new Error('Unauthorized');
    }

    if (!response.ok) {
      let message = 'Request failed';
      let errorCode = null;
      try {
        const data = await response.json();
        message = data.message || message;
        errorCode = data.error || null;
      } catch {}

      if (response.status === 403 && (errorCode === 'ONBOARDING_REQUIRED' || message.includes('empresa'))) {
        if (!window.location.pathname.startsWith('/onboarding')) {
          console.warn('[API] Usuario sin empresa, redirigiendo a onboarding...');
          const { router } = await import('../router.js');
          router.navigate('/onboarding');
        }
        throw new Error('ONBOARDING_REQUIRED');
      }

      console.error('[API] Response error:', response.status, message);
      throw new Error(message);
    }

    return response;
  }

  async refreshToken() {
    if (this.isRefreshing) {
      return new Promise(resolve => {
        this.pendingRequests.push(resolve);
      });
    }

    this.isRefreshing = true;

    try {
      const refreshToken = getRefreshToken();
      
      if (!refreshToken) {
        return false;
      }

      const response = await fetch(`${this.baseUrl}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });

      if (!response.ok) {
        return false;
      }

      const data = await response.json();
      
      if (data.accessToken) {
        setToken(data.accessToken, data.refreshToken);
        
        this.pendingRequests.forEach(resolve => resolve(true));
        this.pendingRequests = [];
        
        return true;
      }

      return false;
    } catch (error) {
      console.error('Error refreshing token:', error);
      return false;
    } finally {
      this.isRefreshing = false;
    }
  }

  get(endpoint, params = {}, options = {}) {
    const query = new URLSearchParams(params).toString();
    return this.request(`${endpoint}${query ? `?${query}` : ''}`, { method: 'GET', ...options });
  }

  async getBlob(path) {
    const token = this.getToken();
    const res = await fetch(`${this.baseUrl}${path}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) throw new Error('Error descargando archivo');
    return res.blob();
  }

  async postFormData(path, formData) {
    const token = this.getToken();
    const res = await fetch(`${this.baseUrl}${path}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Error');
    return data;
  }

  // Alias for postFormData
  postForm(path, formData) {
    return this.postFormData(path, formData);
  }

  post(endpoint, data = {}) {
    const body = data instanceof FormData ? data : JSON.stringify(data);
    return this.request(endpoint, { method: 'POST', body });
  }

  streamPost(endpoint, data = {}) {
    const body = data instanceof FormData ? data : JSON.stringify(data);
    return this.requestRaw(endpoint, { method: 'POST', body });
  }

  put(endpoint, data = {}) {
    const body = data instanceof FormData ? data : JSON.stringify(data);
    return this.request(endpoint, { method: 'PUT', body });
  }

  patch(endpoint, data = {}) {
    const body = data instanceof FormData ? data : JSON.stringify(data);
    return this.request(endpoint, { method: 'PATCH', body });
  }

  delete(endpoint) {
    return this.request(endpoint, { method: 'DELETE' });
  }

  async upload(endpoint, formData) {
    return this.request(endpoint, {
      method: 'POST',
      body: formData,
    });
  }

  async download(endpoint) {
    const token = this.getToken();
    
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new Error('Download failed');
    }

    return response.blob();
  }

  async downloadAndSave(endpoint, filename) {
    const blob = await this.download(endpoint);
    
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  }
}

export const api = new ApiClient();

api.setToken = (token, refreshToken) => {
  setToken(token, refreshToken);
};

api.getToken = () => {
  return getToken();
};
