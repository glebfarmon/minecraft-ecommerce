import {type BrowserContext, expect, test} from '@playwright/test'

const WEB = process.env.WEB_URL ?? 'http://shop.localhost'

test.use({viewport: {width: 1600, height: 900}})

const setCart = (context: BrowserContext, value: string) =>
  context.addCookies([{name: 'cart', value, url: WEB}])

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
  await page.getByRole('button', {name: 'Add VIP to cart'}).click()
  await expect(page.getByRole('button', {name: /^Cart, 1 item$/})).toBeVisible()
  expect((await context.cookies()).find(c => c.name === 'cart')?.value).toBe('survival:vip:1')
  await page.goto(`${WEB}/rules`)
  await expect(page.getByRole('button', {name: /^Cart, 1 item$/})).toBeVisible()
})

test('the cart survives a locale switch', async ({context, page}) => {
  await setCart(context, 'survival:vip:2')
  await page.goto(`${WEB}/pl/rules`)
  await expect(page.getByRole('button', {name: /^Koszyk, 2 przedmioty$/})).toBeVisible()
})
