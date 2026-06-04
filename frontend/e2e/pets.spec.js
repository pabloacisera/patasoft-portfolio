import { test, expect } from '@playwright/test';

test.describe('CRUD de Mascotas', () => {
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

  test('3.4.1 - Renderiza lista de mascotas', async ({ page }) => {
    await expect(page.locator('h1, h2')).toContainText(/mascotas/i);
    await expect(page.locator('table, .pets-list, .data-table')).toBeVisible();
  });

  test('3.4.2 - Tiene botón para crear mascota', async ({ page }) => {
    const createBtn = page.locator('button:has-text("Nuevo"), button:has-text("Crear"), button:has-text("Agregar")');
    await expect(createBtn.first()).toBeVisible();
  });

  test('3.4.3 - Tiene barra de búsqueda', async ({ page }) => {
    const searchInput = page.locator('input[type="search"], input[placeholder*="buscar" i], .search-input');
    await expect(searchInput.first()).toBeVisible();
  });

  test('3.4.4 - Modal de crear mascota se abre', async ({ page }) => {
    const createBtn = page.locator('button:has-text("Nuevo"), button:has-text("Crear"), button:has-text("Agregar")');
    await createBtn.first().click();
    
    const modal = page.locator('.modal, [role="dialog"], .modal-overlay');
    await expect(modal.first()).toBeVisible();
  });

  test('3.4.5 - Formulario de mascota tiene campos básicos', async ({ page }) => {
    const createBtn = page.locator('button:has-text("Nuevo"), button:has-text("Crear"), button:has-text("Agregar")');
    await createBtn.first().click();
    
    await page.waitForSelector('.modal, [role="dialog"]');
    
    const nameInput = page.locator('input[name="name"], input[id*="name" i]').first();
    await expect(nameInput).toBeVisible();
  });

  test('3.4.6 - Tabla muestra columnas básicas', async ({ page }) => {
    const table = page.locator('table').first();
    await expect(table).toBeVisible();
    
    const headers = await table.locator('th').allTextContents();
    const headersText = headers.join(' ').toLowerCase();
    
    expect(headersText).toContain('nombre');
  });

  test('3.4.7 - Filtro por especie si existe', async ({ page }) => {
    const speciesFilter = page.locator('select[name*="species" i], select[id*="species" i], select:has(option:has-text("Perro"))');
    const filterExists = await speciesFilter.first().isVisible().catch(() => false);
    
    if (filterExists) {
      await expect(speciesFilter.first()).toBeVisible();
    }
  });
});
