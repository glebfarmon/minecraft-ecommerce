import {type Page, expect} from '@playwright/test'
import {generateSync} from 'otplib'

import {latestMail, newestMailId} from './mailpit'

/** Email code sign-in on /login or an invite page (where the email is prefilled and read-only). */
export async function signInWithCode(page: Page, email: string) {
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
export async function setUpTotp(page: Page): Promise<string> {
  const secret = (await page.getByTestId('totp-secret').textContent()) ?? ''
  expect(secret).not.toBe('')
  await page.getByLabel('Code from the app').fill(generateSync({secret}))
  await page.getByRole('button', {name: 'Confirm'}).click()
  await expect(page.getByTestId('backup-codes')).toBeVisible()
  await page.getByRole('button', {name: 'I saved them'}).click()
  await expect(page.getByRole('heading', {name: /^Welcome/})).toBeVisible()
  return secret
}
