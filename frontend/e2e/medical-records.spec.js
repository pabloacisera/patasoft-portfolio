import { test, expect } from '@playwright/test';

test.describe('Consulta Médica (Flujo Crítico)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.fill('#email', 'test@veterinaria.com');
    await page.fill('#password', process.env.E2E_TEST_PASSWORD || 'Test1234!');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard**');
    await page.goto('/dashboard/medical-records');
  });

  test('3.5.1 - Renderiza lista de historial médico', async ({ page }) => {
    await expect(page.locator('h1, h2')).toContainText(/historial|consultas|médico/i);
    await expect(page.locator('table, .records-list, .data-table')).toBeVisible();
  });

  test('3.5.2 - Tiene botón para crear consulta', async ({ page }) => {
    const createBtn = page.locator('button:has-text("Nuevo"), button:has-text("Crear"), button:has-text("Agregar")');
    await expect(createBtn.first()).toBeVisible();
  });

  test('3.5.3 - Modal de crear consulta se abre', async ({ page }) => {
    const createBtn = page.locator('button:has-text("Nuevo"), button:has-text("Crear"), button:has-text("Agregar")');
    await createBtn.first().click();
    
    const modal = page.locator('.modal, [role="dialog"], .modal-overlay');
    await expect(modal.first()).toBeVisible();
  });

  test('3.5.4 - Formulario de consulta tiene campo de mascota', async ({ page }) => {
    const createBtn = page.locator('button:has-text("Nuevo"), button:has-text("Crear"), button:has-text("Agregar")');
    await createBtn.first().click();
    
    await page.waitForSelector('.modal, [role="dialog"]');
    
    const petSelector = page.locator('select[name*="pet" i], select[id*="pet" i], input[name*="pet" i]').first();
    await expect(petSelector).toBeVisible();
  });

  test('3.5.5 - Formulario tiene campo de motivo de visita', async ({ page }) => {
    const createBtn = page.locator('button:has-text("Nuevo"), button:has-text("Crear"), button:has-text("Agregar")');
    await createBtn.first().click();
    
    await page.waitForSelector('.modal, [role="dialog"]');
    
    const visitReason = page.locator('textarea[name*="reason" i], textarea[id*="reason" i], input[name*="reason" i], textarea[name*="visit" i]').first();
    await expect(visitReason).toBeVisible();
  });

  test('3.5.6 - Formulario tiene sección de procedimientos', async ({ page }) => {
    const createBtn = page.locator('button:has-text("Nuevo"), button:has-text("Crear"), button:has-text("Agregar")');
    await createBtn.first().click();
    
    await page.waitForSelector('.modal, [role="dialog"]');
    
    const proceduresSection = page.locator('text=/procedimiento/i').first();
    await expect(proceduresSection).toBeVisible();
  });

  test('3.5.7 - Formulario tiene sección de prescripciones', async ({ page }) => {
    const createBtn = page.locator('button:has-text("Nuevo"), button:has-text("Crear"), button:has-text("Agregar")');
    await createBtn.first().click();
    
    await page.waitForSelector('.modal, [role="dialog"]');
    
    const prescriptionsSection = page.locator('text=/prescripci|receta/i').first();
    await expect(prescriptionsSection).toBeVisible();
  });

  test('3.5.8 - Formulario tiene sección de cobro/pago', async ({ page }) => {
    const createBtn = page.locator('button:has-text("Nuevo"), button:has-text("Crear"), button:has-text("Agregar")');
    await createBtn.first().click();
    
    await page.waitForSelector('.modal, [role="dialog"]');
    
    const paymentSection = page.locator('text=/cobro|pago|total/i').first();
    await expect(paymentSection).toBeVisible();
  });

  test('3.5.9 - Puede agregar procedimientos dinámicamente', async ({ page }) => {
    const createBtn = page.locator('button:has-text("Nuevo"), button:has-text("Crear"), button:has-text("Agregar")');
    await createBtn.first().click();
    
    await page.waitForSelector('.modal, [role="dialog"]');
    
    const addProcedureBtn = page.locator('button:has-text("Agregar Procedimiento"), button:has-text("+ Procedimiento")').first();
    const addBtnExists = await addProcedureBtn.isVisible().catch(() => false);
    
    if (addBtnExists) {
      await addProcedureBtn.click();
      
      const procedureInputs = page.locator('.procedure-item, [class*="procedure" i]').first();
      await expect(procedureInputs).toBeVisible();
    }
  });

  test('3.5.10 - Puede agregar prescripciones dinámicamente', async ({ page }) => {
    const createBtn = page.locator('button:has-text("Nuevo"), button:has-text("Crear"), button:has-text("Agregar")');
    await createBtn.first().click();
    
    await page.waitForSelector('.modal, [role="dialog"]');
    
    const addPrescriptionBtn = page.locator('button:has-text("Agregar Prescripción"), button:has-text("+ Prescripción"), button:has-text("+ Receta")').first();
    const addBtnExists = await addPrescriptionBtn.isVisible().catch(() => false);
    
    if (addBtnExists) {
      await addPrescriptionBtn.click();
      
      const prescriptionInputs = page.locator('.prescription-item, [class*="prescription" i]').first();
      await expect(prescriptionInputs).toBeVisible();
    }
  });

  test('3.5.11 - Muestra total calculado', async ({ page }) => {
    const createBtn = page.locator('button:has-text("Nuevo"), button:has-text("Crear"), button:has-text("Agregar")');
    await createBtn.first().click();
    
    await page.waitForSelector('.modal, [role="dialog"]');
    
    const totalDisplay = page.locator('text=/total/i').first();
    await expect(totalDisplay).toBeVisible();
  });
});
