import { test, expect } from '@playwright/test';

test.describe('Onboarding', () => {
  test('3.2.1 - Renderiza wizard de onboarding', async ({ page }) => {
    await page.goto('/onboarding');
    
    await expect(page.locator('#app')).toBeVisible();
    await expect(page.locator('h1')).toContainText(/crear.*empresa|configuración/i);
  });

  test('3.2.2 - Muestra formulario de datos de empresa', async ({ page }) => {
    await page.goto('/onboarding');
    
    const nameInput = page.locator('input[name="name"], #company-name');
    await expect(nameInput).toBeVisible();
  });

  test('3.2.3 - Tiene botón de siguiente/continuar', async ({ page }) => {
    await page.goto('/onboarding');
    
    const nextBtn = page.locator('button:has-text("Siguiente"), button:has-text("Continuar"), button:has-text("Crear")');
    await expect(nextBtn.first()).toBeVisible();
  });

  test('3.2.4 - Muestra información de trial gratuito', async ({ page }) => {
    await page.goto('/onboarding');
    
    const trialInfo = page.locator('text=/prueba|trial|gratis/i');
    await expect(trialInfo.first()).toBeVisible();
  });
});
