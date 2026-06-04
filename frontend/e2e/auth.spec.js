import { test, expect } from '@playwright/test';

test.describe('Autenticación', () => {
  test('3.1.1 - Renderiza formulario de login', async ({ page }) => {
    await page.goto('/login');
    
    await expect(page.locator('h1')).toContainText('PataSoft');
    await expect(page.locator('#login-form')).toBeVisible();
    await expect(page.locator('#email')).toBeVisible();
    await expect(page.locator('#password')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toContainText('Iniciar Sesión');
  });

  test('3.1.2 - Renderiza formulario de registro', async ({ page }) => {
    await page.goto('/register');
    
    await expect(page.locator('h1')).toContainText('Crear Cuenta');
    await expect(page.locator('#register-form')).toBeVisible();
    await expect(page.locator('#name')).toBeVisible();
    await expect(page.locator('#email')).toBeVisible();
    await expect(page.locator('#password')).toBeVisible();
  });

  test('3.1.3 - Muestra error con credenciales inválidas', async ({ page }) => {
    await page.goto('/login');
    
    await page.fill('#email', 'invalido@test.com');
    await page.fill('#password', 'password123');
    await page.click('button[type="submit"]');
    
    await expect(page.locator('#login-error')).toBeVisible();
    await expect(page.locator('#login-error')).not.toHaveText('');
  });

  test('3.1.4 - Redirige a login cuando no hay autenticación', async ({ page }) => {
    await page.goto('/login');
    await page.evaluate(() => localStorage.clear());
    await page.goto('/dashboard');
    
    await expect(page).toHaveURL(/.*login.*/);
  });

  test('3.1.5 - Valida campos requeridos en login', async ({ page }) => {
    await page.goto('/login');
    
    const emailInput = page.locator('#email');
    const passwordInput = page.locator('#password');
    
    await expect(emailInput).toHaveAttribute('required', '');
    await expect(passwordInput).toHaveAttribute('required', '');
  });

  test('3.1.6 - Botón de Google está presente', async ({ page }) => {
    await page.goto('/login');
    
    const googleBtn = page.locator('#google-btn');
    await expect(googleBtn).toBeVisible();
    await expect(googleBtn).toContainText('Continuar con Google');
  });

  test('3.1.7 - Link a registro está presente en login', async ({ page }) => {
    await page.goto('/login');
    
    const registerLink = page.locator('a[href="/register"]');
    await expect(registerLink).toBeVisible();
    await expect(registerLink).toContainText('Registrate');
  });

  test('3.1.8 - Link a login está presente en registro', async ({ page }) => {
    await page.goto('/register');
    
    const loginLink = page.locator('a[href="/login"]');
    await expect(loginLink).toBeVisible();
  });
});
