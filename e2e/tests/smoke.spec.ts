import { expect, test } from '@playwright/test';

const WEB = process.env.WEB_URL ?? 'http://shop.localhost';
const ADMIN = process.env.ADMIN_URL ?? 'http://admin.shop.localhost';
const API = process.env.API_URL ?? 'http://api.shop.localhost';

test('storefront renders styled home page', async ({ page }) => {
  await page.goto(WEB);
  const heading = page.getByRole('heading', { level: 1, name: 'Minecraft Shop' });
  await expect(heading).toBeVisible();
  await expect(page.getByRole('button', { name: 'Browse servers' })).toBeVisible();
  // `text-4xl` = 36px. Browser default h1 is 32px, so this fails if Tailwind CSS did not load.
  expect(await heading.evaluate((el) => getComputedStyle(el).fontSize)).toBe('36px');
});

test('admin renders and is noindex', async ({ page }) => {
  await page.goto(ADMIN);
  await expect(page.getByRole('heading', { level: 1, name: 'Shop Admin' })).toBeVisible();
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
});

test('api health reachable on every host', async ({ request }) => {
  for (const url of [`${WEB}/api/health`, `${ADMIN}/api/health`, `${API}/api/health`]) {
    const res = await request.get(url);
    expect(res.status(), url).toBe(200);
    expect(await res.json(), url).toMatchObject({ status: 'ok' });
  }
});

test('unknown api route returns JSON 404 from api, not a Next page', async ({ request }) => {
  const res = await request.get(`${WEB}/api/does-not-exist`);
  expect(res.status()).toBe(404);
  expect(res.headers()['content-type']).toContain('application/json');
});
