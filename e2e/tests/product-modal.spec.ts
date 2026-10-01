import {expect, test} from '@playwright/test'

const WEB = process.env.WEB_URL ?? 'http://shop.localhost'

test('product opens as a modal from the catalog and as a page on direct load', async ({page}) => {
  await page.goto(`${WEB}/survival`)
  await page.getByRole('link', {name: 'VIP', exact: true}).click()

  await expect(page).toHaveURL(/\/survival\/vip$/)
  await expect(page.getByRole('dialog', {name: 'VIP'})).toBeVisible()

  await page.goto(`${WEB}/survival/vip`)
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(page.getByRole('link', {name: 'Back to shop'})).toBeVisible()
})
