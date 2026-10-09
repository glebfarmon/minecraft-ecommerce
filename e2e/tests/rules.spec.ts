import {expect, test} from '@playwright/test'

const WEB = process.env.WEB_URL ?? 'http://shop.localhost'

test.use({viewport: {width: 1600, height: 900}})

test('a PL rule link scrolls to and flashes the rule', async ({page}) => {
  await page.goto(`${WEB}/pl/rules#r-2-3`)
  const rule = page.locator('#r-2-3')
  await expect(rule).toBeInViewport()
  await expect(rule).toHaveCSS('animation-name', 'rule-flash')
})

test('PL search ignores diacritics and highlights the original word', async ({page}) => {
  await page.goto(`${WEB}/pl/rules`)
  await page.getByRole('searchbox', {name: 'Szukaj w zasadach'}).fill('zlosliwe')
  await expect(page.locator('mark', {hasText: 'Złośliwe'})).toBeVisible()
  await expect(page.locator('#r-1-1')).toHaveCount(0)
})

test('"/" focuses the search', async ({page}) => {
  await page.goto(`${WEB}/rules`)
  await page.keyboard.press('/')
  await expect(page.getByRole('searchbox', {name: 'Search the rules'})).toBeFocused()
})

test('section counts use Polish plural forms', async ({page}) => {
  await page.goto(`${WEB}/pl/rules`)
  await expect(page.getByText('4 punkty').first()).toBeVisible()
  await expect(page.getByText('5 punktów')).toBeVisible()
})

// Separate tests: visiting /pl sets next-intl's locale cookie, which then redirects /rules to /pl/rules.
test('edition date is localized in PL', async ({page}) => {
  await page.goto(`${WEB}/pl/rules`)
  await expect(page.getByText('Obowiązująca wersja z 28 maja 2026')).toBeVisible()
})

test('edition date is localized in EN', async ({page}) => {
  await page.goto(`${WEB}/rules`)
  await expect(page.getByText('Current edition: May 28, 2026')).toBeVisible()
})

test.describe('copy link', () => {
  test.skip(
    ({browserName}) => browserName !== 'chromium',
    'clipboard permissions are Chromium-only'
  )
  test.use({permissions: ['clipboard-read', 'clipboard-write']})

  for (const [path, label] of [
    ['/pl/rules', 'Kopiuj link do zasady 2.3'],
    ['/rules', 'Copy link to rule 2.3']
  ] as const) {
    test(`on ${path} copies a link in that language`, async ({page}) => {
      await page.goto(`${WEB}${path}`)
      await page.locator('#r-2-3').hover()
      await page.getByRole('button', {name: label}).click()
      await expect(page.locator('#r-2-3').getByRole('status')).not.toBeEmpty()
      expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(`${WEB}${path}#r-2-3`)
    })
  }
})

test.describe('phone', () => {
  test.use({viewport: {width: 375, height: 800}})

  test('no horizontal scroll and contents open from a popover', async ({page}) => {
    await page.goto(`${WEB}/pl/rules`)
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth
    )
    expect(overflow).toBeLessThanOrEqual(0)
    await page.getByRole('button', {name: 'Pokaż spis treści'}).click()
    await page
      .getByRole('dialog')
      .getByRole('link', {name: /Rozgrywka/})
      .click()
    await expect(page).toHaveURL(/\/pl\/rules#s-4$/)
  })
})
