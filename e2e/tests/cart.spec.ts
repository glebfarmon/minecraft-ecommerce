import {type BrowserContext, type Page, expect, test} from '@playwright/test'

const WEB = process.env.WEB_URL ?? 'http://shop.localhost'

test.use({viewport: {width: 1600, height: 900}})

const setCart = (context: BrowserContext, value: string) =>
  context.addCookies([{name: 'cart', value, url: WEB}])

// Buttons are in the server HTML before React attaches handlers; the navbar marks hydration.
const hydrated = (page: Page) =>
  expect(page.getByRole('navigation', {name: 'Main'})).toHaveAttribute('data-animate')

test('the cart is in the server HTML and /rules ships no other products', async ({context}) => {
  await setCart(context, 'survival:vip:2')
  const html = await (await context.request.get(`${WEB}/rules`)).text()
  expect(html).toContain('Cart, 2 items')
  // An Anarchy product: on the catalog pages, never on /rules unless it is in the cart.
  expect(html).not.toContain('shards-2500')
})

test('a cart line for a product that no longer exists is dropped', async ({context, page}) => {
  await setCart(context, 'survival:vip:1|survival:gone-forever:3')
  await page.goto(`${WEB}/`)
  await expect(page.getByRole('button', {name: /^Cart, 1 item$/})).toBeVisible()
})

test('a product added on home is still in the cart on /rules', async ({context, page}) => {
  await page.goto(`${WEB}/`)
  await hydrated(page)
  await page.getByRole('button', {name: 'Add VIP to cart'}).click()
  await expect(page.getByRole('button', {name: /^Cart, 1 item$/})).toBeVisible()
  expect((await context.cookies()).find(c => c.name === 'cart')?.value).toBe('survival:vip:1')
  await page.goto(`${WEB}/rules`)
  await expect(page.getByRole('button', {name: /^Cart, 1 item$/})).toBeVisible()
})

test('the cart survives a locale switch made in the settings menu', async ({page}) => {
  await page.goto(`${WEB}/`)
  await hydrated(page)
  await page.getByRole('button', {name: 'Add VIP to cart'}).click()
  await page.getByRole('button', {name: 'Add VIP to cart'}).click()
  await expect(page.getByRole('button', {name: /^Cart, 2 items$/})).toBeVisible()
  await page.getByRole('button', {name: 'Language and currency'}).click()
  await expect(page.getByRole('dialog', {name: 'Language and currency'})).toBeVisible()
  await page.getByRole('radio', {name: /Polski/}).click()
  // The PL page renders on the server; WebKit in Docker can take a few seconds.
  await expect(page).toHaveURL(/\/pl$/, {timeout: 15_000})
  await expect(page.getByRole('button', {name: /^Koszyk, 2 przedmioty$/})).toBeVisible()
})

test('a tab picks up a cart change made in another tab', async ({context}) => {
  const first = await context.newPage()
  await first.goto(`${WEB}/rules`)
  await hydrated(first)
  const second = await context.newPage()
  await second.goto(`${WEB}/`)
  await hydrated(second)
  await second.getByRole('button', {name: 'Add VIP to cart'}).click()
  await expect(second.getByRole('button', {name: /^Cart, 1 item$/})).toBeVisible()
  await first.bringToFront()
  await first.evaluate(() => document.dispatchEvent(new Event('visibilitychange')))
  await expect(first.getByRole('button', {name: /^Cart, 1 item$/})).toBeVisible()
})
