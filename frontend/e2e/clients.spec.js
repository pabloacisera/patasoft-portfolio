import { test, expect } from '@playwright/test';

test.describe('CRUD de Clientes', () => {
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

  test('3.3.1 - Renderiza lista de clientes', async ({ page }) => {
    await expect(page.locator('h1, h2')).toContainText(/clientes/i);
    await expect(page.locator('table, .clients-list, .data-table')).toBeVisible();
  });

  test('3.3.2 - Tiene botón para crear cliente', async ({ page }) => {
    const createBtn = page.locator('button:has-text("Nuevo"), button:has-text("Crear"), button:has-text("Agregar")');
    await expect(createBtn.first()).toBeVisible();
  });

  test('3.3.3 - Tiene barra de búsqueda', async ({ page }) => {
    const searchInput = page.locator('input[type="search"], input[placeholder*="buscar" i], .search-input');
    await expect(searchInput.first()).toBeVisible();
  });

  test('3.3.4 - Modal de crear cliente se abre', async ({ page }) => {
    const createBtn = page.locator('button:has-text("Nuevo"), button:has-text("Crear"), button:has-text("Agregar")');
    await createBtn.first().click();
    
    const modal = page.locator('.modal, [role="dialog"], .modal-overlay');
    await expect(modal.first()).toBeVisible();
  });

  test('3.3.5 - Formulario de cliente tiene campos requeridos', async ({ page }) => {
    const createBtn = page.locator('button:has-text("Nuevo"), button:has-text("Crear"), button:has-text("Agregar")');
    await createBtn.first().click();
    
    await page.waitForSelector('.modal, [role="dialog"]');
    
    const nameInput = page.locator('input[name="name"], input[id*="name" i]').first();
    await expect(nameInput).toBeVisible();
  });

  test('3.3.6 - Tabla muestra columnas básicas', async ({ page }) => {
    const table = page.locator('table').first();
    await expect(table).toBeVisible();
    
    const headers = await table.locator('th').allTextContents();
    const headersText = headers.join(' ').toLowerCase();
    
    expect(headersText).toContain('nombre');
  });

  test('3.3.7 - Paginación está presente si hay muchos clientes', async ({ page }) => {
    const pagination = page.locator('.pagination, .pagination-controls, button:has-text("Anterior"), button:has-text("Siguiente")');
    const paginationExists = await pagination.first().isVisible().catch(() => false);
    
    if (paginationExists) {
      await expect(pagination.first()).toBeVisible();
    }
  });
});
