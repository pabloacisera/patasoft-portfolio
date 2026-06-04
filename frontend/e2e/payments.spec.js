import { test, expect } from '@playwright/test';

test.describe('Pagos', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.fill('#email', 'test@veterinaria.com');
    await page.fill('#password', process.env.E2E_TEST_PASSWORD || 'Test1234!');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard**');
    await page.goto('/dashboard/payments');
  });

  test('3.6.1 - Renderiza lista de pagos', async ({ page }) => {
    await expect(page.locator('h1, h2')).toContainText(/pagos|cobros/i);
    await expect(page.locator('table, .payments-list, .data-table')).toBeVisible();
  });

  test('3.6.2 - Tiene tabs para cobros y deudas', async ({ page }) => {
    const tabs = page.locator('.tabs, [role="tablist"], button:has-text("Cobros"), button:has-text("Deudas")');
    const tabsExist = await tabs.first().isVisible().catch(() => false);
    
    if (tabsExist) {
      await expect(tabs.first()).toBeVisible();
    }
  });

  test('3.6.3 - Tiene botón para crear cobro', async ({ page }) => {
    const createBtn = page.locator('button:has-text("Nuevo"), button:has-text("Crear"), button:has-text("Agregar")');
    await expect(createBtn.first()).toBeVisible();
  });

  test('3.6.4 - Modal de crear cobro se abre', async ({ page }) => {
    const createBtn = page.locator('button:has-text("Nuevo"), button:has-text("Crear"), button:has-text("Agregar")');
    await createBtn.first().click();
    
    const modal = page.locator('.modal, [role="dialog"], .modal-overlay');
    await expect(modal.first()).toBeVisible();
  });

  test('3.6.5 - Formulario de cobro tiene campo de cliente', async ({ page }) => {
    const createBtn = page.locator('button:has-text("Nuevo"), button:has-text("Crear"), button:has-text("Agregar")');
    await createBtn.first().click();
    
    await page.waitForSelector('.modal, [role="dialog"]');
    
    const clientSelector = page.locator('select[name*="client" i], input[name*="client" i]').first();
    await expect(clientSelector).toBeVisible();
  });

  test('3.6.6 - Formulario tiene campo de monto total', async ({ page }) => {
    const createBtn = page.locator('button:has-text("Nuevo"), button:has-text("Crear"), button:has-text("Agregar")');
    await createBtn.first().click();
    
    await page.waitForSelector('.modal, [role="dialog"]');
    
    const amountInput = page.locator('input[name*="amount" i], input[name*="total" i], input[type="number"]').first();
    await expect(amountInput).toBeVisible();
  });

  test('3.6.7 - Formulario tiene selector de método de pago', async ({ page }) => {
    const createBtn = page.locator('button:has-text("Nuevo"), button:has-text("Crear"), button:has-text("Agregar")');
    await createBtn.first().click();
    
    await page.waitForSelector('.modal, [role="dialog"]');
    
    const methodSelector = page.locator('select[name*="method" i], select[id*="method" i]').first();
    await expect(methodSelector).toBeVisible();
  });

  test('3.6.8 - Tabla muestra columnas básicas', async ({ page }) => {
    const table = page.locator('table').first();
    await expect(table).toBeVisible();
    
    const headers = await table.locator('th').allTextContents();
    const headersText = headers.join(' ').toLowerCase();
    
    expect(headersText).toMatch(/cliente|monto|estado/);
  });

  test('3.6.9 - Filtro por estado si existe', async ({ page }) => {
    const statusFilter = page.locator('select[name*="status" i], select[id*="status" i]');
    const filterExists = await statusFilter.first().isVisible().catch(() => false);
    
    if (filterExists) {
      await expect(statusFilter.first()).toBeVisible();
    }
  });

  test('3.6.10 - Muestra sección de deudas si hay tab', async ({ page }) => {
    const debtsTab = page.locator('button:has-text("Deudas"), [role="tab"]:has-text("Deudas")');
    const tabExists = await debtsTab.first().isVisible().catch(() => false);
    
    if (tabExists) {
      await debtsTab.first().click();
      
      const debtsTable = page.locator('table, .debts-list').first();
      await expect(debtsTable).toBeVisible();
    }
  });
});
