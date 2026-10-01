import {expect, test} from '@playwright/test'

const WEB = process.env.WEB_URL ?? 'http://shop.localhost'
const ADMIN = process.env.ADMIN_URL ?? 'http://admin.shop.localhost'
const API = process.env.API_URL ?? 'http://api.shop.localhost'

test('storefront renders styled home page', async ({page}) => {
  await page.goto(WEB)
  await expect(page).toHaveURL(/\/en$/)
  await expect(page.getByRole('heading', {level: 1, name: 'Your new second home'})).toBeAttached()
  const browse = page.getByRole('link', {name: 'Browse shop'})
  await expect(browse).toBeVisible()
  // The accent fill comes from Tailwind + globals.css; an unstyled page has a transparent link.
  expect(await browse.evaluate(el => getComputedStyle(el).backgroundColor)).toBe(
    'rgb(255, 107, 26)'
  )
})

test('admin renders and is noindex', async ({page}) => {
  await page.goto(ADMIN)
  await expect(page.getByRole('heading', {level: 1, name: 'Shop Admin'})).toBeVisible()
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/)
})

test('api health reachable on every host', async ({request}) => {
  for (const url of [`${WEB}/api/health`, `${ADMIN}/api/health`, `${API}/api/health`]) {
    const res = await request.get(url)
    expect(res.status(), url).toBe(200)
    expect(await res.json(), url).toMatchObject({status: 'ok'})
  }
})

test('unknown api route returns JSON 404 from api, not a Next page', async ({request}) => {
  const res = await request.get(`${WEB}/api/does-not-exist`)
  expect(res.status()).toBe(404)
  expect(res.headers()['content-type']).toContain('application/json')
})
