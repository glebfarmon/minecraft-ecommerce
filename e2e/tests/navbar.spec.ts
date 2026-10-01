import {expect, test} from '@playwright/test'

const WEB = process.env.WEB_URL ?? 'http://shop.localhost'
const TRANSPARENT = 'rgba(0, 0, 0, 0)'

// Wide enough that the max-width shrink is visible (gutter caps at 64px).
test.use({viewport: {width: 1600, height: 900}})

test('navbar turns into a floating pill on scroll', async ({page}) => {
  await page.goto(`${WEB}/`)
  const nav = page.getByRole('navigation', {name: 'Main'})
  const width = async () => (await nav.boundingBox())?.width ?? 0
  const bg = () => nav.evaluate(el => getComputedStyle(el).backgroundColor)

  // data-animate is set only after hydration, so the checks below see the live component.
  await expect(nav).toHaveAttribute('data-animate')
  await expect(nav).not.toHaveAttribute('data-scrolled')
  expect(await bg()).toBe(TRANSPARENT)
  const flatWidth = await width()

  await page.mouse.wheel(0, 600)
  await expect(nav).toHaveAttribute('data-scrolled')
  await expect.poll(width).toBeLessThan(flatWidth)
  await expect.poll(bg).not.toBe(TRANSPARENT)

  await page.evaluate(() => {
    window.scrollTo({top: 0, behavior: 'instant'})
  })
  await expect(nav).not.toHaveAttribute('data-scrolled')
  await expect.poll(width).toBe(flatWidth)
})

test('pill shows at once, without animating, after loading a deep anchor', async ({page}) => {
  await page.goto(`${WEB}/#faq`)
  const nav = page.getByRole('navigation', {name: 'Main'})
  await expect(nav).toHaveAttribute('data-scrolled')
  const width = async () => (await nav.boundingBox())?.width ?? 0
  const first = await width()
  // Longer than the 300ms transition: an animated pill would still be shrinking at `first`.
  await page.waitForTimeout(400)
  expect(await width()).toBe(first)
})

test('pill slides between links on hover and hides on leave', async ({page}) => {
  await page.goto(`${WEB}/`)
  const nav = page.getByRole('navigation', {name: 'Main'})
  await expect(nav).toHaveAttribute('data-animate')
  const pill = nav.locator('[data-nav-pill]')
  const pillX = async () => (await pill.first().boundingBox())?.x ?? -1

  await expect(pill).toHaveCount(0)

  const links = nav.getByRole('list').getByRole('link')
  await links.nth(1).hover()
  await expect(pill).toHaveCount(1)
  const firstX = await pillX()

  await links.nth(2).hover()
  // The pill ends exactly under the new link (inset-x-0), and there is still only one.
  const target = (await links.nth(2).boundingBox())?.x ?? 0
  await expect.poll(pillX).toBeGreaterThan(firstX)
  await expect.poll(pillX).toBeCloseTo(target, 0)
  await expect(pill).toHaveCount(1)

  await page.mouse.move(5, 450)
  await expect(pill).toHaveCount(0)
})
