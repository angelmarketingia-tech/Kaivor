import { test, expect } from '@playwright/test';

const PROD = 'https://kaivor.vercel.app';

// ── Auth pages ─────────────────────────────────────────────────────────────────

test.describe('Login page', () => {
  test('carga con branding Kaivor', async ({ page }) => {
    await page.goto(PROD + '/auth/login');
    await expect(page.locator('text=Kaivor').first()).toBeVisible();
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
  });

  test('tiene link a registro', async ({ page }) => {
    await page.goto(PROD + '/auth/login');
    const regLink = page.locator('a[href*="register"]');
    await expect(regLink).toBeVisible();
  });
});

test.describe('Register page', () => {
  test('carga con formulario', async ({ page }) => {
    await page.goto(PROD + '/auth/register');
    await expect(page.locator('text=Kaivor').first()).toBeVisible();
    await expect(page.locator('input[type="email"]')).toBeVisible();
  });
});

// ── Pricing page ───────────────────────────────────────────────────────────────

test.describe('Pricing page', () => {
  test('muestra planes incluyendo Enterprise (CSR hydrated)', async ({ page }) => {
    await page.goto(PROD + '/pricing');
    // Wait for CSR hydration - plan cards appear after JS runs
    await page.waitForSelector('text=Gratis', { timeout: 15000 });
    await expect(page.locator('text=Enterprise').first()).toBeVisible();
  });

  test('muestra 45 facturas en plan Free', async ({ page }) => {
    await page.goto(PROD + '/pricing');
    await page.waitForSelector('text=45', { timeout: 15000 });
    await expect(page.locator('text=45').first()).toBeVisible();
  });
});

// ── Protected routes ────────────────────────────────────────────────────────────

test.describe('Rutas protegidas redirigen a login', () => {
  const routes = ['/dashboard', '/invoices', '/customers', '/products', '/settings', '/ai-insights'];

  for (const route of routes) {
    test(`${route} -> login`, async ({ page }) => {
      await page.goto(PROD + route);
      await page.waitForLoadState('networkidle');
      expect(page.url()).toContain('login');
    });
  }
});

// ── Full user flow ──────────────────────────────────────────────────────────────

test.describe('Flujo completo: registro → dashboard → navegacion', () => {
  const email = `e2e-${Date.now()}@kaivor-test.com`;
  const password = 'Test1234!';

  test('registra usuario nuevo y llega al dashboard', async ({ page }) => {
    await page.goto(PROD + '/auth/register');
    // fill name (first text input)
    const textInputs = page.locator('input[type="text"]');
    await textInputs.first().fill('E2E Test User');
    await page.fill('input[type="email"]', email);
    await page.fill('input[type="password"]', password);
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard', { timeout: 20000 });
    expect(page.url()).toContain('dashboard');
  });

  test('dashboard muestra sidebar con navegacion', async ({ page }) => {
    await page.goto(PROD + '/auth/login');
    await page.fill('input[type="email"]', email);
    await page.fill('input[type="password"]', password);
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard', { timeout: 20000 });
    // sidebar should have navigation links
    await expect(page.locator('a[href="/invoices"]').first()).toBeVisible();
    await expect(page.locator('a[href="/customers"]').first()).toBeVisible();
    await expect(page.locator('a[href="/products"]').first()).toBeVisible();
  });

  test('navega a /invoices y muestra boton Nueva factura', async ({ page }) => {
    await page.goto(PROD + '/auth/login');
    await page.fill('input[type="email"]', email);
    await page.fill('input[type="password"]', password);
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard', { timeout: 20000 });
    await page.click('a[href="/invoices"]');
    await page.waitForURL('**/invoices', { timeout: 10000 });
    await expect(page.locator('text=Nueva factura').first()).toBeVisible();
  });

  test('navega a /customers y muestra boton Nuevo cliente', async ({ page }) => {
    await page.goto(PROD + '/auth/login');
    await page.fill('input[type="email"]', email);
    await page.fill('input[type="password"]', password);
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard', { timeout: 20000 });
    await page.click('a[href="/customers"]');
    await page.waitForURL('**/customers', { timeout: 10000 });
    await expect(page.locator('text=Nuevo cliente').first()).toBeVisible();
  });

  test('navega a /products y muestra boton Nuevo producto', async ({ page }) => {
    await page.goto(PROD + '/auth/login');
    await page.fill('input[type="email"]', email);
    await page.fill('input[type="password"]', password);
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard', { timeout: 20000 });
    await page.click('a[href="/products"]');
    await page.waitForURL('**/products', { timeout: 10000 });
    await expect(page.locator('text=Nuevo producto').first()).toBeVisible();
  });

  test('navega a /settings y muestra hub de configuracion', async ({ page }) => {
    await page.goto(PROD + '/auth/login');
    await page.fill('input[type="email"]', email);
    await page.fill('input[type="password"]', password);
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard', { timeout: 20000 });
    await page.click('a[href="/settings"]');
    await page.waitForURL('**/settings', { timeout: 10000 });
    await expect(page.locator('text=Empresa').first()).toBeVisible();
  });

  test('/invoices/create muestra wizard de 3 pasos', async ({ page }) => {
    await page.goto(PROD + '/auth/login');
    await page.fill('input[type="email"]', email);
    await page.fill('input[type="password"]', password);
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard', { timeout: 20000 });
    await page.goto(PROD + '/invoices/create');
    await page.waitForLoadState('networkidle');
    // should show wizard steps
    const body = await page.content();
    expect(body).toContain('Cliente');
    expect(body).toContain('Productos');
  });
});
