import {expect, test} from '@playwright/test'

const WEB = process.env.WEB_URL ?? 'http://shop.localhost'
const TRANSPARENT = 'rgba(0, 0, 0, 0)'

// Wide enough that the 1440px → 1200px shrink is visible (gutter caps at 64px).
test.use({viewport: {width: 1600, height: 900}})

test('navbar turns into a floating pill on scroll', async ({page}) => {
  await page.goto(`${WEB}/`)
  const nav = page.getByRole('navigation', {name: 'Main'})
  const width = async () => (await nav.boundingBox())?.width ?? 0
  const bg = () => nav.evaluate(el => getComputedStyle(el).backgroundColor)

  await expect(nav).not.toHaveAttribute('data-scrolled')
  expect(await bg()).toBe(TRANSPARENT)
  expect(await width()).toBe(1440)

  await page.mouse.wheel(0, 600)
  await expect(nav).toHaveAttribute('data-scrolled')
  await expect.poll(width).toBe(1200)
  await expect.poll(bg).not.toBe(TRANSPARENT)

  await page.evaluate(() => {
    window.scrollTo({top: 0, behavior: 'instant'})
  })
  await expect(nav).not.toHaveAttribute('data-scrolled')
  await expect.poll(width).toBe(1440)
})

test('pill is on after loading a deep anchor', async ({page}) => {
  await page.goto(`${WEB}/#faq`)
  await expect(page.getByRole('navigation', {name: 'Main'})).toHaveAttribute('data-scrolled')
})
