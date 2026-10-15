import {type Page, expect, test} from '@playwright/test'
import {generateSync} from 'otplib'

import {inviteLink, latestMail, newestMailId} from '../support/mailpit'

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
  expect(invite.subject).toBe('You are invited to Shop Admin')
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
  await owner.getByLabel('Role', {exact: true}).selectOption({label: 'SUPPORT'})
  await owner.getByRole('button', {name: 'Send invite'}).click()
  await expect(owner.getByText(`Invite sent to ${SUE}.`)).toBeVisible()
  await ownerContext.close()

  await page.goto(inviteLink(await latestMail(SUE)))
  await signInWithCode(page, SUE)
  await setUpTotp(page)
  await expect(page.getByRole('link', {name: 'Home'})).toBeVisible()
  await expect(page.getByRole('link', {name: 'Audit log'})).toHaveCount(0)
  const res = await page.goto(`${ADMIN}/audit`)
  expect(res?.status()).toBe(404)
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
  await page.getByRole('tab', {name: 'PL'}).click()
  await page.getByLabel('Name (PL)').fill('Ranga Próbna')
  await page.getByLabel('Grant commands').fill('lp user {nick} parent add probe')
  await page.getByRole('button', {name: 'Save'}).click()
  await expect(page).toHaveURL(/\/catalog\/products\/\w+$/)
  await page.getByLabel('Enabled').check()
  await page.getByRole('button', {name: 'Save'}).click()
  await expect(page.getByText('Saved. Live on the site within a minute.')).toBeVisible()

  // Keyboard drag: the new product starts last; one step up puts it above Legend.
  await page.goto(`${ADMIN}/catalog`)
  const list = page.getByRole('list', {name: 'Products in Ranks'})
  await expect(list.getByRole('link')).toHaveText(['VIP', 'Elite', 'Legend', 'Probe Rank'])
  await list.getByRole('button', {name: 'Move Probe Rank'}).focus()
  // dnd-kit attaches its key listeners and measures rects asynchronously: pause between keys.
  await page.keyboard.press('Space')
  await page.waitForTimeout(300)
  await page.keyboard.press('ArrowUp')
  await page.waitForTimeout(300)
  await page.keyboard.press('Space')
  await expect(list.getByRole('link')).toHaveText(['VIP', 'Elite', 'Probe Rank', 'Legend'])
  await page.reload()
  await expect(list.getByRole('link')).toHaveText(['VIP', 'Elite', 'Probe Rank', 'Legend'])

  // The storefront caches the catalog for up to 60 s.
  const shop = await page.context().newPage()
  await expect
    .poll(
      async () => {
        await shop.goto(`${WEB}/`)
        return shop.getByRole('button', {name: /^(Elite|Probe Rank|Legend)$/}).allTextContents()
      },
      {timeout: 90_000, intervals: [5_000]}
    )
    .toEqual(['Elite', 'Probe Rank', 'Legend'])

  // Leave the shared stack as the other e2e tests expect it.
  await page.getByRole('link', {name: 'Probe Rank'}).click()
  await page.getByLabel('Enabled').uncheck()
  await page.getByRole('button', {name: 'Save'}).click()
  await expect(page.getByText('Saved. Live on the site within a minute.')).toBeVisible()
  await page.getByRole('button', {name: 'Delete'}).click()
  await page.getByRole('button', {name: 'Confirm delete'}).click()
  await expect(page).toHaveURL(/\/catalog$/)
})
