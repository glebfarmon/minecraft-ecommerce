import {type Page, expect, test} from '@playwright/test'
import {generateSync} from 'otplib'

import {buyVip} from '../support/checkout'
import {type Mail, findMail, inviteLink, latestMail, newestMailId} from '../support/mailpit'

// Runs against a fresh stack: the seed mails the owner invite once (`docker compose ... down -v`
// before a local rerun), and the tests build on each other (the owner's TOTP secret).
const ADMIN = process.env.ADMIN_URL ?? 'http://admin.shop.localhost'
const OWNER = 'owner@shop.localhost'
const SUE = 'sue@shop.localhost'

// No retries: a retry would rerun the group against state the first attempt already changed.
test.describe.configure({mode: 'serial', retries: 0})
test.skip(({browserName}) => browserName !== 'chromium', 'one browser is enough for the auth flow')

/** Email code sign-in on /login or an invite page (where the email is prefilled and read-only). */
async function signInWithCode(page: Page, email: string) {
  const field = page.getByLabel('Email')
  if (await field.isEditable()) await field.fill(email)
  else await expect(field).toHaveValue(email)
  const before = await newestMailId(email)
  await page.getByRole('button', {name: 'Send code'}).click()
  await expect(page.getByLabel('6-digit code')).toBeVisible()
  const mail = await latestMail(email, {after: before})
  const code = /^(\d{6})/.exec(mail.subject)?.[1]
  if (!code) throw new Error(`no sign-in code in "${mail.subject}"`)
  await page.getByLabel('6-digit code').fill(code)
  await page.getByRole('button', {name: 'Sign in'}).click()
  await expect(page).toHaveURL(/\/2fa$/)
}

/** Enrolls TOTP on /2fa, saves the backup codes and returns the secret. */
async function setUpTotp(page: Page): Promise<string> {
  const secret = (await page.getByTestId('totp-secret').textContent()) ?? ''
  expect(secret).not.toBe('')
  await page.getByLabel('Code from the app').fill(generateSync({secret}))
  await page.getByRole('button', {name: 'Confirm'}).click()
  await expect(page.getByTestId('backup-codes')).toBeVisible()
  await page.getByRole('button', {name: 'I saved them'}).click()
  await expect(page.getByRole('heading', {name: /^Welcome/})).toBeVisible()
  return secret
}

let ownerSecret = ''
let lastOwnerStep = 0

/** The owner's next accepted TOTP code: never a step already used, at most one step ahead. */
async function ownerCode(page: Page): Promise<string> {
  const step = Math.max(Math.floor(Date.now() / 30_000), lastOwnerStep + 1)
  while (step > Math.floor(Date.now() / 30_000) + 1) await page.waitForTimeout(1000)
  lastOwnerStep = step
  return generateSync({secret: ownerSecret, epoch: step * 30})
}

test('the owner accepts the seeded invite, sets up TOTP and reaches the team page', async ({
  page
}) => {
  const invite = await latestMail(OWNER)
  expect(invite.subject).toMatch(/^You are invited to .+ Admin$/)
  await page.goto(inviteLink(invite))
  await signInWithCode(page, OWNER)
  ownerSecret = await setUpTotp(page)
  lastOwnerStep = Math.floor(Date.now() / 30_000)
  await page.getByRole('link', {name: 'Team'}).click()
  await expect(page.getByRole('heading', {name: 'Team'})).toBeVisible()
})

test('a SUPPORT admin cannot open the audit log', async ({page, browser}) => {
  // The owner invites sue as SUPPORT from a separate browser context.
  const ownerContext = await browser.newContext()
  const owner = await ownerContext.newPage()
  await owner.goto(`${ADMIN}/login`)
  await signInWithCode(owner, OWNER)
  // The API refuses a TOTP it already accepted (replay guard, 90 s): ownerCode never reuses a step.
  await owner.getByLabel('Code from the app').fill(await ownerCode(owner))
  await owner.getByRole('button', {name: 'Verify'}).click()
  await expect(owner.getByRole('heading', {name: /^Welcome/})).toBeVisible()
  await owner.goto(`${ADMIN}/team`)
  await owner.getByRole('tab', {name: 'Invites'}).click()
  await owner.getByLabel('Email', {exact: true}).fill(SUE)
  await owner.getByRole('combobox', {name: 'Role', exact: true}).click()
  await owner.getByRole('option', {name: 'SUPPORT'}).click()
  await owner.getByRole('button', {name: 'Send invite'}).click()
  await expect(owner.getByText(`Invite sent to ${SUE}.`)).toBeVisible()
  await ownerContext.close()

  await page.goto(inviteLink(await latestMail(SUE)))
  await signInWithCode(page, SUE)
  await setUpTotp(page)
  await expect(page.getByRole('link', {name: 'Home'})).toBeVisible()
  await expect(page.getByRole('link', {name: 'Audit log'})).toHaveCount(0)
  // SUPPORT holds order.read; assert the page and its search, not rows (checkout specs run in parallel).
  await expect(page.getByRole('link', {name: 'Orders'})).toBeVisible()
  await page.getByRole('link', {name: 'Orders'}).click()
  await expect(page.getByRole('heading', {name: 'Orders', exact: true})).toBeVisible()
  await expect(page.getByLabel('Search by nick, email or order number')).toBeVisible()
  // The shell's loading.tsx streams the response, so a notFound() below it is a soft 404: status 200
  // with the not-found UI (Next streaming contract). What matters is that no audit data renders.
  await page.goto(`${ADMIN}/audit`)
  await expect(page.getByText('This page could not be found.')).toBeVisible()
  await expect(page.getByRole('heading', {name: 'Audit log'})).toHaveCount(0)
})

test('a signed-in session without TOTP is sent to /2fa', async ({page}) => {
  await page.goto(`${ADMIN}/login`)
  await signInWithCode(page, OWNER)
  await page.goto(`${ADMIN}/team`)
  await expect(page).toHaveURL(/\/2fa$/)
  await expect(page.getByLabel('Code from the app')).toBeVisible()
})

test('the owner adds a product, enables it, moves it up and the shop shows it there', async ({
  page
}) => {
  test.setTimeout(180_000)
  const WEB = process.env.WEB_URL ?? 'http://shop.localhost'
  await page.goto(`${ADMIN}/login`)
  await signInWithCode(page, OWNER)
  await page.getByLabel('Code from the app').fill(await ownerCode(page))
  await page.getByRole('button', {name: 'Verify'}).click()
  await expect(page.getByRole('heading', {name: /^Welcome/})).toBeVisible()

  await page.getByRole('link', {name: 'Catalog'}).click()
  await page.getByRole('link', {name: '+ Product in Ranks'}).click()
  await page.getByLabel('Slug').fill('probe-rank')
  await page.getByLabel('Mark').fill('PRB')
  await page.getByLabel('Price EUR').fill('3.49')
  await page.getByLabel('Price PLN').fill('14.99')
  await page.getByLabel('Name (EN)').fill('Probe Rank')
  const description = page.getByLabel('Description (EN)')
  await description.fill('Probe')
  await description.dblclick({position: {x: 20, y: 18}})
  // ProseMirror takes the DOM selection a moment after the double-click; the shortcut needs it.
  await expect
    .poll(() =>
      description.evaluate(
        el =>
          (el as HTMLElement & {editor: {state: {selection: {empty: boolean}}}}).editor.state
            .selection.empty
      )
    )
    .toBe(false)
  await page.keyboard.press('ControlOrMeta+u')
  await expect(description.locator('u')).toHaveText('Probe')
  await page.getByRole('tab', {name: 'PL'}).click()
  await page.getByLabel('Name (PL)').fill('Ranga Próbna')
  await page.getByLabel('Grant commands').fill('lp user {nick} parent add probe')
  // From the first Save on the product may exist: always remove it, even when a step below fails,
  // so the shared stack stays as the other e2e tests expect it (and a rerun can create it again).
  try {
    await page.getByRole('button', {name: 'Save'}).click()
    await expect(page).toHaveURL(/\/catalog\/products\/\w+$/)
    await page.reload()
    await expect(page.getByLabel('Description (EN)').locator('u')).toHaveText('Probe')
    await page.getByLabel('Enabled').check()
    await page.getByRole('button', {name: 'Save'}).click()
    await expect(page.getByText('Saved. Live on the site within a minute.')).toBeVisible()

    // Keyboard drag: the new product starts last in the card grid; one step left puts it before Legend.
    await page.goto(`${ADMIN}/catalog`)
    const list = page.getByRole('list', {name: 'Products in Ranks'})
    await expect(list.getByRole('link')).toHaveText(['VIP', 'Elite', 'Legend', 'Probe Rank'])
    await list.getByRole('button', {name: 'Move Probe Rank'}).focus()
    // dnd-kit attaches its key listeners and measures rects asynchronously: pause between keys.
    await page.keyboard.press('Space')
    await page.waitForTimeout(300)
    await page.keyboard.press('ArrowLeft')
    await page.waitForTimeout(300)
    await page.keyboard.press('Space')
    await expect(list.getByRole('link')).toHaveText(['VIP', 'Elite', 'Probe Rank', 'Legend'])
    await page.reload()
    await expect(list.getByRole('link')).toHaveText(['VIP', 'Elite', 'Probe Rank', 'Legend'])

    // The e2e stack sets CATALOG_REVALIDATE_SECONDS=1; allow for the stale-while-revalidate turnover under CI load.
    const shop = await page.context().newPage()
    await expect
      .poll(
        async () => {
          await shop.goto(`${WEB}/`)
          return shop.getByRole('button', {name: /^(Elite|Probe Rank|Legend)$/}).allTextContents()
        },
        {timeout: 30_000, intervals: [2_000]}
      )
      .toEqual(['Elite', 'Probe Rank', 'Legend'])
  } finally {
    await page.goto(`${ADMIN}/catalog`)
    const probe = page.getByRole('list', {name: 'Products in Ranks'}).getByRole('link', {
      name: 'Probe Rank'
    })
    if ((await probe.count()) > 0) {
      await probe.click()
      const enabled = page.getByLabel('Enabled')
      if (await enabled.isChecked()) {
        await enabled.uncheck()
        await page.getByRole('button', {name: 'Save'}).click()
        await expect(page.getByText('Saved. Live on the site within a minute.')).toBeVisible()
      }
      await page.getByRole('button', {name: 'Delete'}).click()
      await page.getByRole('button', {name: 'Confirm delete'}).click()
      await expect(page).toHaveURL(/\/catalog$/)
    }
  }
})

/** Signs the owner in with an email code and a fresh TOTP code, up to the dashboard. */
async function signInOwner(page: Page) {
  await page.goto(`${ADMIN}/login`)
  await signInWithCode(page, OWNER)
  await page.getByLabel('Code from the app').fill(await ownerCode(page))
  await page.getByRole('button', {name: 'Verify'}).click()
  await expect(page.getByRole('heading', {name: /^Welcome/})).toBeVisible()
}

test('the owner publishes a rule edit and the rules page shows it', async ({page}) => {
  test.setTimeout(180_000)
  const WEB = process.env.WEB_URL ?? 'http://shop.localhost'
  // One word, so a double-click selects all of it.
  const probe = `ProbeRule${String(Date.now())}`
  await signInOwner(page)
  await page.getByRole('link', {name: 'Content', exact: true}).click()
  await page.getByRole('link', {name: 'Rules', exact: true}).click()
  const field = page.getByLabel('Rule 1.1 (EN)')
  await expect(field).toBeVisible()
  // The rule field is a rich text editor: keep its document (marks included) to put back.
  const editorDoc = (el: HTMLElement) =>
    (el as HTMLElement & {editor: {getJSON(): unknown}}).editor.getJSON()
  const original = await field.evaluate(editorDoc)
  expect(JSON.stringify(original)).toContain('"text"')

  // From the first published probe the site shows it: always restore the seeded text and publish
  // it again, so rules.spec.ts finds the content it expects.
  try {
    await field.fill(probe)
    await field.dblclick({position: {x: 40, y: 18}})
    await page.getByRole('button', {name: 'Bold'}).click()
    await expect(
      page.getByRole('region', {name: 'Preview'}).locator('strong', {hasText: probe})
    ).toBeVisible()
    await page.getByRole('button', {name: 'Save draft'}).click()
    await expect(page.getByText('Unsaved changes')).toHaveCount(0)
    await page.getByRole('button', {name: 'Publish', exact: true}).click()
    await page.getByRole('button', {name: 'Publish now'}).click()
    await expect(
      page.getByText('Published. Visible on the site within about a minute.')
    ).toBeVisible()

    const shop = await page.context().newPage()
    await expect
      .poll(
        async () => {
          await shop.goto(`${WEB}/rules`)
          return shop.getByText(probe).count()
        },
        {timeout: 30_000, intervals: [2_000]}
      )
      .toBeGreaterThan(0)
    await shop.close()
  } finally {
    await page.goto(`${ADMIN}/content/rules`)
    const restore = page.getByLabel('Rule 1.1 (EN)')
    await expect(restore).toBeVisible()
    if (JSON.stringify(await restore.evaluate(editorDoc)) !== JSON.stringify(original)) {
      await restore.evaluate((el, doc) => {
        ;(
          el as HTMLElement & {
            editor: {commands: {setContent(d: unknown, o: {emitUpdate: boolean}): void}}
          }
        ).editor.commands.setContent(doc, {emitUpdate: true})
      }, original)
      await page.getByRole('button', {name: 'Save draft'}).click()
      await expect(page.getByText('Unsaved changes')).toHaveCount(0)
    }
    await page.getByRole('button', {name: 'Publish', exact: true}).click()
    await page.getByRole('button', {name: 'Publish now'}).click()
    await expect(
      page.getByText('Published. Visible on the site within about a minute.')
    ).toBeVisible()
  }
})

test('the owner overrides the hero title and the home page shows it', async ({page}) => {
  test.setTimeout(180_000)
  const WEB = process.env.WEB_URL ?? 'http://shop.localhost'
  await signInOwner(page)
  await page.getByRole('link', {name: 'Content', exact: true}).click()
  await page.getByRole('link', {name: 'Texts', exact: true}).click()
  await page.getByLabel('Search texts').fill('hero.title')
  const row = page.getByRole('row').filter({has: page.getByLabel('Override for hero.title')})
  const original = (await row.getByRole('cell').nth(1).innerText()).trim()
  expect(original).not.toBe('')
  // Plain words change; placeholders ({count}) and tags (<b>) stay as they are.
  const next = original
    .split(/(<[^>]*>|\{[^}]*\})/)
    .map((part, i) => (i % 2 === 0 ? part.replace(/[\p{L}]+/gu, 'Probe') : part))
    .join('')
  expect(next).not.toBe(original)

  const input = page.getByLabel('Override for hero.title')
  try {
    await input.fill(next)
    await row.getByRole('button', {name: 'Save'}).click()
    await expect(row.getByText('changed')).toBeVisible()

    const shop = await page.context().newPage()
    await expect
      .poll(
        async () => {
          await shop.goto(`${WEB}/`)
          return (await shop.locator('h1 .sr-only').textContent()) ?? ''
        },
        {timeout: 30_000, intervals: [2_000]}
      )
      .toBe(next)
    await shop.close()
  } finally {
    await page.goto(`${ADMIN}/content/texts`)
    await page.getByLabel('Search texts').fill('hero.title')
    const reset = page
      .getByRole('row')
      .filter({has: page.getByLabel('Override for hero.title')})
      .getByRole('button', {
        name: 'Reset'
      })
    if ((await reset.count()) > 0) {
      await reset.click()
      await expect(reset).toHaveCount(0)
    }
  }
})

test('the owner sees the dashboard and can open an order row menu with the keyboard', async ({
  page
}) => {
  await signInOwner(page)
  const revenue = page.getByRole('region', {name: 'Revenue', exact: true})
  await expect(revenue).toBeVisible()
  await expect(page.getByRole('region', {name: 'Average order'})).toBeVisible()
  await expect(page.getByRole('region', {name: 'Conversion'})).toBeVisible()
  await expect(page.getByRole('region', {name: 'LTV'})).toBeVisible()
  // One currency for the whole dashboard (default EUR); the e2e stack uses the fixed 4.3000 rate.
  await expect(revenue).toContainText('€')
  await page.getByRole('tablist', {name: 'Currency'}).getByRole('tab', {name: 'PLN'}).click()
  await expect(revenue).toContainText('PLN')
  await expect(revenue).not.toContainText('€')

  await page.getByRole('link', {name: 'Orders'}).click()
  await expect(page.getByRole('heading', {name: 'Orders', exact: true})).toBeVisible()
  // Paid orders exist only when the checkout spec ran first; the row menu check needs one.
  const table = page.getByRole('table', {name: 'Orders'})
  if ((await table.count()) > 0 && (await table.getByRole('row').count()) > 1) {
    const trigger = table.getByRole('button', {name: /^Actions for /}).first()
    await trigger.focus()
    await page.keyboard.press('Enter')
    await expect(page.getByRole('menuitem', {name: 'Open'})).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(trigger).toBeFocused()
    // A click anywhere on the row (here the date cell) opens the order.
    await table.getByRole('row').nth(1).getByRole('cell').nth(1).click()
    await expect(page).toHaveURL(/\/orders\/\w+$/)
    await page.goBack()
  }

  await page.setViewportSize({width: 390, height: 844})
  for (const path of ['/', '/orders', '/catalog', '/team', '/audit']) {
    await page.goto(`${ADMIN}${path}`)
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth
    )
    expect(overflow, `horizontal scroll on ${path}`).toBeLessThanOrEqual(0)
  }
  await page.getByRole('button', {name: 'Open menu'}).click()
  await expect(
    page.getByRole('dialog', {name: 'Menu'}).getByRole('link', {name: 'Orders'})
  ).toBeVisible()
})

test('the owner switches sub-navs, opens editors from pencils and the preview follows PL', async ({
  page
}) => {
  test.setTimeout(180_000)
  await signInOwner(page)

  await page.getByRole('link', {name: 'Content', exact: true}).click()
  const content = page.getByRole('navigation', {name: 'Content'})
  await content.getByRole('link', {name: 'Rules'}).click()
  const preview = page.getByRole('region', {name: 'Preview'})
  await expect(preview).toBeVisible()
  await page.getByRole('tablist', {name: 'Language'}).getByRole('tab', {name: 'PL'}).click()
  await expect(preview.getByRole('heading', {level: 2})).toHaveText('Preview · PL')
  await page.getByRole('tablist', {name: 'Language'}).getByRole('tab', {name: 'EN'}).click()
  await expect(preview.getByRole('heading', {level: 2})).toHaveText('Preview · EN')

  await content.getByRole('link', {name: 'Texts'}).click()
  await expect(content.getByRole('link', {name: 'Texts'})).toHaveAttribute('aria-current', 'page')
  await expect(page.getByLabel('Search texts')).toBeVisible()

  await page.getByRole('link', {name: 'Catalog', exact: true}).click()
  const catalog = page.getByRole('navigation', {name: 'Catalog'})
  await catalog.getByRole('link', {name: 'Categories'}).click()
  await expect(page.getByRole('table', {name: 'Categories'})).toBeVisible()
  await catalog.getByRole('link', {name: 'Products'}).click()

  await page.getByRole('link', {name: 'Edit Ranks'}).click()
  await expect(page.getByText('Edit Ranks')).toBeVisible()
  await catalog.getByRole('link', {name: 'Products'}).click()
  await page
    .getByRole('tablist', {name: 'Server'})
    .getByRole('link', {name: /^Edit /})
    .first()
    .click()
  await expect(page).toHaveURL(/\/catalog\/servers\/\w+$/)
})

test('the rail marks a clicked page at once and its pill stays put inside a section', async ({
  page
}) => {
  // Signing in can wait up to 30 s for an unused TOTP step, as in the other owner tests.
  test.setTimeout(180_000)
  // A slow server from the start, so no route is ready before the click: prefetches fail (the
  // loading fallback cannot commit early) and every other RSC request answers after 1.5 s.
  await page.route('**/*', async route => {
    const headers = route.request().headers()
    if (headers['next-router-prefetch']) return route.abort()
    if (headers.rsc === '1') await new Promise(r => setTimeout(r, 1500))
    return route.fallback()
  })
  await signInOwner(page)
  const rail = page.getByRole('navigation', {name: 'Admin'})
  // Scoped to the nav: the aside also holds the language switch and its own pill.
  const pill = rail.locator('[data-slot=rolling-indicator]')

  const orders = rail.getByRole('link', {name: 'Orders'})
  await orders.click()
  await expect(orders).toHaveAttribute('aria-current', 'page', {timeout: 300})
  await expect(orders.locator('[data-slot=rolling-indicator]')).toHaveCount(1, {timeout: 300})
  // Still on the dashboard: the mark comes from the click, not from the committed path.
  expect(new URL(page.url()).pathname).toBe('/')
  await expect(page.getByRole('heading', {name: 'Orders', exact: true})).toBeVisible()
  await page.unrouteAll({behavior: 'wait'})

  // Catalog → product: the page scrolls to the top, the fixed rail does not move, nor its pill.
  await page.setViewportSize({width: 1280, height: 480})
  await page.goto(`${ADMIN}/catalog`)
  const vip = page.getByRole('list', {name: 'Products in Ranks'}).getByRole('link', {name: 'VIP'})
  await expect(vip).toBeVisible()
  // Scroll the card to the middle of the viewport: the page is scrolled (header and servers sit
  // above it) and the card stays clickable; the very bottom can push it out of a 480 px view.
  await vip.evaluate(el => {
    el.scrollIntoView({block: 'center'})
  })
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(0)
  await expect(vip).toBeInViewport()
  const top = () => pill.evaluate(el => Math.round(el.getBoundingClientRect().top))
  const before = await top()
  // force: in CI Playwright reported the card "not stable" for 30 s while the screencast showed a
  // still page (sub-pixel layout churn at this 480 px viewport). This test is about the pill.
  await vip.click({force: true})
  await page.waitForTimeout(100)
  expect(await top()).toBe(before)
  await expect(page).toHaveURL(/\/catalog\/products\/\w+$/)
  expect(await top()).toBe(before)
})

test('the owner switches the admin to Polish, it persists and the 390 px layout holds', async ({
  page
}) => {
  test.setTimeout(180_000)
  await signInOwner(page)
  try {
    await page
      .getByRole('radiogroup', {name: 'Language'})
      .getByRole('radio', {name: 'Polski'})
      .click()
    await expect(page.getByRole('link', {name: 'Zamówienia'})).toBeVisible()
    await expect(page.locator('html')).toHaveAttribute('lang', 'pl')
    await page.reload()
    await expect(page.getByRole('link', {name: 'Zamówienia'})).toBeVisible()
    await expect(page.locator('html')).toHaveAttribute('lang', 'pl')

    await page.setViewportSize({width: 390, height: 844})
    for (const path of [
      '/',
      '/orders',
      '/catalog',
      '/catalog/categories',
      '/catalog/servers/new',
      '/catalog/products/new',
      '/team',
      '/audit',
      '/account',
      '/content/rules',
      '/content/texts',
      '/content/settings'
    ]) {
      await page.goto(`${ADMIN}${path}`)
      await expect(page.locator('html')).toHaveAttribute('lang', 'pl')
      await expect(page.getByRole('main')).toBeVisible()
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - window.innerWidth
      )
      expect(overflow, `horizontal scroll on ${path} in Polish`).toBeLessThanOrEqual(0)
    }

    // The sheet menu carries the same switch; use it to go back.
    await page.getByRole('button', {name: 'Otwórz menu'}).click()
    const sheet = page.getByRole('dialog', {name: 'Menu'})
    await expect(sheet.getByRole('link', {name: 'Zamówienia'})).toBeVisible()
    await sheet
      .getByRole('radiogroup', {name: 'Język'})
      .getByRole('radio', {name: 'English'})
      .click()
    await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  } finally {
    // The suite is serial: leave English behind whatever happened above.
    await page.context().clearCookies({name: 'admin_locale'})
  }
})

test('the owner creates a promo code and a player pays less with it', async ({page, browser}) => {
  test.setTimeout(180_000)
  const WEB = process.env.WEB_URL ?? 'http://shop.localhost'
  const email = `promo-${String(Date.now())}@shop.localhost`
  await signInOwner(page)
  await page.getByRole('link', {name: 'Promo codes', exact: true}).click()
  await page.getByRole('link', {name: /New code/}).click()
  // The dice fills the code; the owner can type over it.
  const code = page.getByLabel('Code', {exact: true})
  const dice = page.getByRole('button', {name: 'Generate a code'})
  await dice.click()
  // The dice is disabled while it rolls, and the roll's frames also match the code format.
  await expect(dice).toBeEnabled()
  await expect(code).toHaveValue(/^[A-HJ-NP-Z]{5}[2-9]{3}$/)
  await code.fill('E2E10')
  await page.getByLabel('Percent', {exact: true}).fill('10')

  // From the first Create the code exists: always remove it, so a rerun can create it again.
  try {
    await page.getByRole('button', {name: 'Create code'}).click()
    await expect(page).toHaveURL(/\/promo-codes\/\w+$/)

    const context = await browser.newContext({viewport: {width: 1600, height: 900}})
    const shop = await context.newPage()
    await shop.goto(`${WEB}/`)
    await expect(shop.getByRole('navigation', {name: 'Main'})).toHaveAttribute('data-animate')
    await shop.getByRole('button', {name: 'Add VIP to cart'}).click()
    await shop.getByRole('button', {name: /^Cart, 1 item$/}).click()
    await shop.getByRole('button', {name: 'Checkout'}).click()
    const dialog = shop.getByRole('dialog', {name: 'Checkout', exact: true})
    await shop.getByLabel('Minecraft nickname').fill('E2e_Promo')
    await shop.getByLabel('Email', {exact: true}).fill(email)
    await dialog.getByText('I agree to immediate delivery').click({position: {x: 4, y: 4}})
    await dialog.getByText('I accept the').click({position: {x: 4, y: 4}})

    await dialog.getByRole('button', {name: 'Have a promo code?'}).click()
    await dialog.getByLabel('Promo code').fill('e2e10')
    await dialog.getByRole('button', {name: 'Apply'}).click()
    await expect(dialog.getByRole('button', {name: 'Remove promo code E2E10'})).toBeVisible({
      timeout: 15_000
    })
    await expect(dialog.getByText(/^−/)).toBeVisible()
    await expect(shop.getByRole('button', {name: /^Pay/})).toBeEnabled({timeout: 30_000})
    await shop.getByRole('button', {name: /^Pay/}).click()

    await expect(shop).toHaveURL(/\/api\/payments\/fake\/cs_fake_/)
    // The last amount in the text: the line reads "VIP × 1 — €4.99".
    const money = (s: string) =>
      Number(
        s
          .replace(/\s/g, '')
          .match(/\d+(?:[.,]\d+)?/g)
          ?.at(-1)
          ?.replace(',', '.')
      )
    const discount = money(await shop.getByText('Discount (E2E10):').innerText())
    const total = money(await shop.getByText('Total:').innerText())
    const line = money(await shop.getByRole('listitem').innerText())
    expect(discount).toBeGreaterThan(0)
    expect(discount).toBeCloseTo(line * 0.1, 1)
    expect(total).toBeCloseTo(line - discount, 2)
    await shop.getByRole('button', {name: 'Pay', exact: true}).click()

    await expect(shop).toHaveURL(/\/order\/[A-Za-z0-9_-]{22}$/)
    await expect(shop.getByRole('heading', {name: 'Paid — thank you!'})).toBeVisible({
      timeout: 30_000
    })
    await expect(shop.getByText('Promo code E2E10')).toBeVisible()
    await context.close()
  } finally {
    await page.goto(`${ADMIN}/promo-codes`)
    const actions = page.getByRole('button', {name: 'Actions for E2E10'})
    if ((await actions.count()) > 0) {
      await actions.click()
      await page.getByRole('menuitem', {name: 'Delete'}).click()
      await page.getByRole('button', {name: 'Confirm delete'}).click()
      await expect(actions).toHaveCount(0)
    }
  }
})

// The two delivery scenarios that need the owner sit here, in the serial group that owns the
// owner's sign-in (see delivery.spec.ts). The first keeps the alert mail the second checks.
let silentOrder = ''
let alertMail: Mail | undefined

test('a silent server leaves the order delayed and the owner can mark it done', async ({
  page,
  browser
}) => {
  test.setTimeout(180_000)
  const context = await browser.newContext({viewport: {width: 1600, height: 900}})
  const shop = await context.newPage()
  // The demo grant command is `say [demo] {nick} bought vip`: with this nick it contains "silent",
  // which the fake RCON server never answers, so the delivery ends NEEDS_REVIEW after the 10 s timeout.
  silentOrder = await buyVip(shop, {
    nick: 'Silent_Steve',
    email: `silent-${String(Date.now())}@shop.localhost`
  })
  await expect(
    shop.getByText('Delivery is delayed, we are on it. You do not need to do anything.')
  ).toBeVisible({timeout: 60_000})
  // Before the owner signs in: the sign-in reads the owner's newest mail, which must be the code,
  // and a delivery marked done is never alerted. The e2e worker alerts every 3 s
  // (DELIVERY_ALERT_INTERVAL_MS) instead of every 5 min.
  expect(silentOrder).not.toBe('')
  alertMail = await findMail(OWNER, {subject: 'Delivery needs attention', text: silentOrder})

  await signInOwner(page)
  await page.getByRole('link', {name: 'Orders'}).click()
  const search = page.getByLabel('Search by nick, email or order number')
  await search.fill(silentOrder)
  await search.press('Enter')
  const row = page.getByRole('table', {name: 'Orders'}).getByRole('row').filter({
    hasText: silentOrder
  })
  await expect(row).toHaveCount(1)
  await row.getByRole('cell').nth(1).click()
  await expect(page).toHaveURL(/\/orders\/\w+$/)
  await expect(page.getByText('Needs review', {exact: true})).toBeVisible()
  await page.getByRole('button', {name: 'Mark as done'}).click()
  await page.getByRole('button', {name: 'Yes, mark as done'}).click()
  await expect(page.getByText('Delivery marked as done')).toBeVisible()

  // The player's page still polls while delivery is delayed: it flips without a reload.
  await expect(shop.getByText('Delivered — your items are in the game.')).toBeVisible({
    timeout: 30_000
  })
  await context.close()
})

test('the owner alert email arrives in Mailpit', () => {
  // Found by the test above, before the owner signed in; an empty id would match any old alert.
  expect(silentOrder).not.toBe('')
  expect(alertMail?.subject).toMatch(/^Delivery needs attention \(\d+\)$/)
  expect(alertMail?.text).toContain(silentOrder)
  expect(alertMail?.text).toContain('Silent_Steve')
  expect(alertMail?.text).toContain('NEEDS_REVIEW')
})
