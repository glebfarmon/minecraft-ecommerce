import {expect, test} from '@playwright/test'

const WEB = process.env.WEB_URL ?? 'http://shop.localhost'

test('product opens as a modal from the catalog; there is no product page', async ({page}) => {
  await page.goto(`${WEB}/survival`)
  await page.getByRole('button', {name: 'VIP', exact: true}).click()

  const dialog = page.getByRole('dialog', {name: 'VIP'})
  await expect(dialog).toBeVisible()
  await expect(page).toHaveURL(/\/survival$/)

  await page.keyboard.press('Escape')
  await expect(dialog).toHaveCount(0)

  await page.getByRole('button', {name: 'VIP', exact: true}).click()
  await expect(dialog).toBeVisible()
  await dialog.getByRole('button', {name: /close/i}).click()
  await expect(dialog).toHaveCount(0)

  // Desktop: empty space left and right of the panel closes it too.
  for (const x of [60, 1220]) {
    await page.getByRole('button', {name: 'VIP', exact: true}).click()
    await expect(dialog).toBeVisible()
    await page.mouse.click(x, 400)
    await expect(dialog).toHaveCount(0)
  }

  // Adding to the cart closes the modal.
  await page.getByRole('button', {name: 'VIP', exact: true}).click()
  await expect(dialog).toBeVisible()
  await dialog.getByRole('button', {name: /add to cart/i}).click()
  await expect(dialog).toHaveCount(0)

  const direct = await page.goto(`${WEB}/survival/vip`)
  expect(direct?.status()).toBe(404)
})
