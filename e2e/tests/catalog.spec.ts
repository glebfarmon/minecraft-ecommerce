import {expect, test} from '@playwright/test'

const WEB = process.env.WEB_URL ?? 'http://shop.localhost'
const CART_STORAGE_KEY = 'shop:v1'

test.use({viewport: {width: 1600, height: 900}})

test('home shows seeded Survival products', async ({page}) => {
  await page.goto(`${WEB}/`)
  await expect(page.getByRole('button', {name: 'VIP', exact: true})).toBeVisible()
})

test('server page shows that server, unknown server is 404', async ({page}) => {
  await page.goto(`${WEB}/anarchy`)
  await expect(page.getByRole('button', {name: 'Raider', exact: true})).toBeVisible()
  const res = await page.goto(`${WEB}/nether`)
  expect(res?.status()).toBe(404)
})

test('Polish page shows Polish category names from the database', async ({page}) => {
  await page.goto(`${WEB}/pl`)
  await expect(page.getByText('Rangi').first()).toBeVisible()
})

test('a product opens in the modal with its price', async ({page}) => {
  await page.goto(`${WEB}/`)
  await page.getByRole('button', {name: 'VIP', exact: true}).click()
  await expect(page.getByRole('dialog', {name: 'VIP'})).toContainText('4.99')
})

test('a saved cart line for a product that no longer exists is dropped', async ({page}) => {
  await page.goto(`${WEB}/`)
  await page.evaluate(key => {
    localStorage.setItem(
      key,
      JSON.stringify({
        cart: [
          {server: 'survival', slug: 'vip', qty: 1},
          {server: 'survival', slug: 'gone-forever', qty: 3}
        ]
      })
    )
  }, CART_STORAGE_KEY)
  await page.reload()
  await expect(page.getByRole('button', {name: /^Cart, 1 item$/})).toBeVisible()
})
