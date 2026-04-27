const AUTH_STORAGE_KEY = 'patasoft_auth';
const COMPANY_STORAGE_KEY = 'patasoft_company';

let authState = {
  user: null,
  token: null,
  refreshToken: null,
  company: null,
  isAuthenticated: false,
};

const listeners = new Set();

function notifyListeners() {
  listeners.forEach(fn => fn(authState));
}

export function getAuthState() {
  return { ...authState };
}

export function subscribe(callback) {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

export function loadFromStorage() {
  try {
    const stored = localStorage.getItem(AUTH_STORAGE_KEY);
    if (stored) {
      const data = JSON.parse(stored);
      authState.user = data.user || null;
      authState.token = data.token || null;
      authState.refreshToken = data.refreshToken || null;
      authState.isAuthenticated = !!data.token;
    }

    const companyStored = localStorage.getItem(COMPANY_STORAGE_KEY);
    if (companyStored) {
      authState.company = JSON.parse(companyStored);
    }

    notifyListeners();
    return authState.isAuthenticated;
  } catch (error) {
    console.error('Error loading auth from storage:', error);
    return false;
  }
}

export function login(userData, token, refreshToken = null) {
  authState.user = userData;
  authState.token = token;
  authState.refreshToken = refreshToken;
  authState.isAuthenticated = true;

  localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify({
    user: userData,
    token: token,
    refreshToken: refreshToken,
  }));

  notifyListeners();
}

export function setUser(userData) {
  authState.user = userData;

  const stored = localStorage.getItem(AUTH_STORAGE_KEY);
  if (stored) {
    const data = JSON.parse(stored);
    data.user = userData;
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(data));
  }

  notifyListeners();
}

export function setToken(token, refreshToken = null) {
  authState.token = token;
  authState.refreshToken = refreshToken;
  authState.isAuthenticated = !!token;

  const stored = localStorage.getItem(AUTH_STORAGE_KEY);
  const data = stored ? JSON.parse(stored) : {};
  data.token = token;
  data.refreshToken = refreshToken;
  localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(data));

  notifyListeners();
}

export function setCompany(company) {
  authState.company = company;
  localStorage.setItem(COMPANY_STORAGE_KEY, JSON.stringify(company));
  notifyListeners();
}

export function logout() {
  authState.user = null;
  authState.token = null;
  authState.refreshToken = null;
  authState.company = null;
  authState.isAuthenticated = false;

  localStorage.removeItem(AUTH_STORAGE_KEY);
  localStorage.removeItem(COMPANY_STORAGE_KEY);

  notifyListeners();

  window.location.href = '/login';
}

export function getToken() {
  return authState.token;
}

export function getRefreshToken() {
  return authState.refreshToken;
}

export function getUser() {
  return authState.user;
}

export function getCompany() {
  return authState.company;
}

export function isAuthenticated() {
  return authState.isAuthenticated;
}

export function hasRole(role) {
  return authState.user?.role === role;
}

loadFromStorage();