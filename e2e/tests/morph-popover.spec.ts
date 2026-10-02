import {expect, test} from '@playwright/test'

const WEB = process.env.WEB_URL ?? 'http://shop.localhost'

test.describe('desktop', () => {
  test.use({viewport: {width: 1600, height: 900}})

  test('settings pill grows into a panel, Escape shrinks it back to focus', async ({page}) => {
    await page.goto(`${WEB}/`)
    const trigger = page.getByRole('button', {name: 'Language and currency'})
    await expect(page.getByRole('navigation', {name: 'Main'})).toHaveAttribute('data-animate')
    await trigger.click()

    const dialog = page.getByRole('dialog', {name: 'Language and currency'})
    // Sampled right after the click: a morph is still growing, a pop-in would already be full size.
    const early = (await dialog.boundingBox())?.width ?? 0
    await page.waitForTimeout(700)
    const settled = (await dialog.boundingBox())?.width ?? 0
    expect(early).toBeLessThan(settled)
    await expect(dialog).toBeFocused()

    await page.keyboard.press('Escape')
    await expect(dialog).toHaveCount(0)
    await expect(trigger).toBeFocused()
  })

  test('opening the cart closes the settings panel', async ({page}) => {
    await page.goto(`${WEB}/`)
    await page.getByRole('button', {name: 'Language and currency'}).click()
    await expect(page.getByRole('dialog', {name: 'Language and currency'})).toBeVisible()
    await page.getByRole('button', {name: /^Cart/}).click()
    await expect(page.getByRole('dialog', {name: 'Your cart'})).toBeVisible()
    await expect(page.getByRole('dialog', {name: 'Language and currency'})).toHaveCount(0)
  })

  test('choosing a currency updates the trigger', async ({page}) => {
    await page.goto(`${WEB}/`)
    await page.getByRole('button', {name: 'Language and currency'}).click()
    await page.getByRole('radio', {name: /PLN/}).click()
    await expect(page.getByRole('button', {name: 'Language and currency'})).toContainText('zł')
  })
})

test.describe('phone', () => {
  test.use({viewport: {width: 375, height: 800}})

  test('cart panel stays inside the viewport', async ({page}) => {
    await page.goto(`${WEB}/`)
    await page.getByRole('button', {name: /^Cart/}).click()
    const dialog = page.getByRole('dialog', {name: 'Your cart'})
    await expect(dialog).toBeVisible()
    await page.waitForTimeout(700)
    const box = await dialog.boundingBox()
    expect(box?.x ?? -1).toBeGreaterThanOrEqual(0)
    expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual(375)
  })
})
