import {type Page, expect, test} from '@playwright/test'
import {generateSync} from 'otplib'

import {inviteLink, latestMail, newestMailId} from '../support/mailpit'

// Runs against a fresh stack: the seed mails the owner invite once (`docker compose ... down -v`
// before a local rerun), and the tests build on each other (the owner's TOTP secret).
const ADMIN = process.env.ADMIN_URL ?? 'http://admin.shop.localhost'
const OWNER = 'owner@shop.localhost'
const SUE = 'sue@shop.localhost'

test.describe.configure({mode: 'serial'})
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

test('the owner accepts the seeded invite, sets up TOTP and reaches the team page', async ({
  page
}) => {
  const invite = await latestMail(OWNER)
  expect(invite.subject).toBe('You are invited to Shop Admin')
  await page.goto(inviteLink(invite))
  await signInWithCode(page, OWNER)
  ownerSecret = await setUpTotp(page)
  await page.getByRole('link', {name: 'Team'}).click()
  await expect(page.getByRole('heading', {name: 'Team'})).toBeVisible()
})

test('a SUPPORT admin cannot open the audit log', async ({page, browser}) => {
  // The owner invites sue as SUPPORT from a separate browser context.
  const ownerContext = await browser.newContext()
  const owner = await ownerContext.newPage()
  await owner.goto(`${ADMIN}/login`)
  await signInWithCode(owner, OWNER)
  await owner.getByLabel('Code from the app').fill(generateSync({secret: ownerSecret}))
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
