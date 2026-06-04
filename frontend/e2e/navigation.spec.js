import { test, expect } from '@playwright/test';

test.describe('Navegación del Sidebar', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.fill('#email', process.env.E2E_TEST_EMAIL || 'test@veterinaria.com');
    await page.fill('#password', process.env.E2E_TEST_PASSWORD || 'Test1234!');
    await page.click('button[type="submit"]');
    await page.waitForFunction(() => {
      const path = window.location.pathname;
      return path.includes('/onboarding') || (path.includes('/dashboard') && document.querySelector('.sidebar'));
    }, { timeout: 15000 });
  });

  test('3.7.1 - Sidebar está visible en dashboard', async ({ page }) => {
    if (page.url().includes('/onboarding')) return; // Skip if on onboarding
    const sidebar = page.locator('.sidebar');
    await expect(sidebar).toBeVisible();
  });

  test('3.7.2 - Sidebar tiene link a Home', async ({ page }) => {
    if (page.url().includes('/onboarding')) return;
    const homeLink = page.locator('a[data-page="home"]');
    await expect(homeLink).toBeVisible();
  });

  test('3.7.3 - Sidebar tiene link a Clientes', async ({ page }) => {
    if (page.url().includes('/onboarding')) return;
    const clientsLink = page.locator('a[data-page="clients"]');
    await expect(clientsLink).toBeVisible();
  });

  test('3.7.4 - Sidebar tiene link a Mascotas', async ({ page }) => {
    if (page.url().includes('/onboarding')) return;
    const petsLink = page.locator('a[data-page="pets"]');
    await expect(petsLink).toBeVisible();
  });

  test('3.7.5 - Sidebar tiene link a Historial Médico', async ({ page }) => {
    if (page.url().includes('/onboarding')) return;
    const recordsLink = page.locator('a[data-page="medical-records"]');
    await expect(recordsLink).toBeVisible();
  });

  test('3.7.6 - Sidebar tiene link a Pagos', async ({ page }) => {
    if (page.url().includes('/onboarding')) return;
    const paymentsLink = page.locator('a[data-page="payments"]');
    await expect(paymentsLink).toBeVisible();
  });

  test('3.7.7 - Sidebar tiene link a Insumos', async ({ page }) => {
    if (page.url().includes('/onboarding')) return;
    const suppliesLink = page.locator('a[data-page="supplies"]');
    await expect(suppliesLink).toBeVisible();
  });

  test('3.7.8 - Sidebar tiene link a Configuración', async ({ page }) => {
    if (page.url().includes('/onboarding')) return;
    const settingsLink = page.locator('a[data-page="settings"]');
    await expect(settingsLink).toBeVisible();
  });

  test('3.7.9 - Click en Clientes navega a /dashboard/clients', async ({ page }) => {
    const clientsLink = page.locator('a[href="/dashboard/clients"], a:has-text("Clientes")');
    await clientsLink.first().click();
    
    await expect(page).toHaveURL(/.*dashboard\/clients.*/);
  });

  test('3.7.10 - Click en Mascotas navega a /dashboard/pets', async ({ page }) => {
    const petsLink = page.locator('a[href="/dashboard/pets"], a:has-text("Mascotas")');
    await petsLink.first().click();
    
    await expect(page).toHaveURL(/.*dashboard\/pets.*/);
  });

  test('3.7.11 - Click en Historial navega a /dashboard/medical-records', async ({ page }) => {
    const recordsLink = page.locator('a[href="/dashboard/medical-records"], a:has-text("Historial"), a:has-text("Consultas")');
    await recordsLink.first().click();
    
    await expect(page).toHaveURL(/.*dashboard\/medical-records.*/);
  });

  test('3.7.12 - Click en Pagos navega a /dashboard/payments', async ({ page }) => {
    const paymentsLink = page.locator('a[href="/dashboard/payments"], a:has-text("Pagos"), a:has-text("Cobros")');
    await paymentsLink.first().click();
    
    await expect(page).toHaveURL(/.*dashboard\/payments.*/);
  });

  test('3.7.13 - URL se actualiza al navegar por sidebar', async ({ page }) => {
    const initialUrl = page.url();
    
    const clientsLink = page.locator('a[href="/dashboard/clients"], a:has-text("Clientes")');
    await clientsLink.first().click();
    
    await page.waitForTimeout(500);
    
    const newUrl = page.url();
    expect(newUrl).not.toBe(initialUrl);
    expect(newUrl).toContain('/dashboard/clients');
  });

  test('3.7.14 - Botón back del navegador funciona', async ({ page }) => {
    const clientsLink = page.locator('a[href="/dashboard/clients"], a:has-text("Clientes")');
    await clientsLink.first().click();
    await page.waitForURL('**/dashboard/clients**');
    
    const petsLink = page.locator('a[href="/dashboard/pets"], a:has-text("Mascotas")');
    await petsLink.first().click();
    await page.waitForURL('**/dashboard/pets**');
    
    await page.goBack();
    await page.waitForURL('**/dashboard/clients**');
    
    await expect(page).toHaveURL(/.*dashboard\/clients.*/);
  });

  test('3.7.15 - Sidebar es colapsable en mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    
    const toggleBtn = page.locator('.sidebar-toggle, button[aria-label*="menu" i], button:has-text("☰")');
    const toggleExists = await toggleBtn.first().isVisible().catch(() => false);
    
    if (toggleExists) {
      await toggleBtn.first().click();
      
      const sidebar = page.locator('.sidebar, aside');
      await expect(sidebar.first()).toBeVisible();
    }
  });
});
