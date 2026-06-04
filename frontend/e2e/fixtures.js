const API_BASE = process.env.API_URL || 'http://localhost:3000/api/v1';

export async function apiRequest(method, path, body = null, token = null) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const options = { method, headers };
  if (body) options.body = JSON.stringify(body);

  const res = await fetch(`${API_BASE}${path}`, options);
  const data = await res.json().catch(() => null);
  return { status: res.status, data };
}

export async function registerUser(email, password, name = 'Test User') {
  return apiRequest('POST', '/auth/register', { email, password, name });
}

export async function loginUser(email, password) {
  return apiRequest('POST', '/auth/login', { email, password });
}

export async function createCompany(token, data = {}) {
  const slug = `e2e-test-${Date.now()}`;
  return apiRequest('POST', '/companies', {
    name: data.name || `E2E Company ${Date.now()}`,
    slug,
    email: data.email || `${slug}@test.com`,
    phone: data.phone || '1234567890',
    address: data.address || 'Test Address 123',
    city: data.city || 'Buenos Aires',
    province: data.province || 'CABA',
    ...data,
  }, token);
}

export async function loginAsTestUser(page) {
  const email = process.env.E2E_TEST_EMAIL;
  const password = process.env.E2E_TEST_PASSWORD;

  if (!email || !password) {
    throw new Error('E2E_TEST_EMAIL and E2E_TEST_PASSWORD must be set in environment');
  }

  const { data } = await loginUser(email, password);
  if (!data.accessToken) throw new Error('Login failed: no access token');

  await page.goto('/login');
  await page.evaluate(({ token, refresh }) => {
    localStorage.setItem('patasoft_auth', JSON.stringify({
      user: { email: '' },
      token,
      refreshToken: refresh,
    }));
  }, { token: data.accessToken, refresh: data.refreshToken });

  return data;
}

export async function cleanupTestCompany(token, companySlug) {
  if (!token || !companySlug) return;
}
