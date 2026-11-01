import {type APIRequestContext, type Page, expect, test} from '@playwright/test'
import {generateSync} from 'otplib'

import {setUpTotp, signInWithCode} from '../support/admin-auth'
import {buyVip} from '../support/checkout'
import {findMail, inviteLink, latestMail} from '../support/mailpit'
import {loadOwnerTotp} from '../support/owner-totp'

// Runs in the `refund` project, after every other project (playwright.config.ts): admin.spec.ts
// enrolls the owner's TOTP and is the only other file that signs the owner in, and the VIP edit
// below must not race the specs that read or edit VIP. The owner signs in once here, in beforeAll,
// before any mail this file causes reaches the owner (the sign-in reads the newest mail).
// Needs a fresh stack even when run alone (`pnpm test:e2e -- refund`): the dependency runs the
// `admin` project first, which consumes the seeded owner invite. Before a rerun:
// `docker compose -f compose.yaml -f compose.e2e.yaml down -v`, then `up -d --wait`.
const ADMIN = process.env.ADMIN_URL ?? 'http://admin.shop.localhost'
const WEB = process.env.WEB_URL ?? 'http://shop.localhost'
const OWNER = 'owner@shop.localhost'
const VIEWPORT = {width: 1600, height: 900}
// The seeded products have no revoke commands, and without one a refund takes nothing back. The
// fake RCON server answers it (no "silent" in it).
const REVOKE = 'say [demo] {nick} lost vip'
const DELIVERED = 'Delivered — your items are in the game.'

// No retries: the tests share the owner's session and the VIP product's revoke command.
test.describe.configure({mode: 'serial', retries: 0})
test.use({viewport: VIEWPORT})

let owner: Page

/** A nick no other test uses, so the order's grant is not shared with another order's. */
function nick(prefix: string) {
  return `${prefix}${String(Date.now()).slice(-6)}`
}

async function openVip() {
  await owner.goto(`${ADMIN}/catalog`)
  await owner
    .getByRole('list', {name: 'Products in Ranks'})
    .getByRole('link', {name: 'VIP', exact: true})
    .click()
  await expect(owner).toHaveURL(/\/catalog\/products\/\w+$/)
}

async function setVipRevoke(value: string) {
  await openVip()
  await owner.getByLabel('Revoke commands').fill(value)
  await owner.getByRole('button', {name: 'Save'}).click()
  await expect(owner.getByText('Saved. Live on the site within a minute.')).toBeVisible()
}

test.beforeAll(async ({browser}) => {
  // Signing in can wait for an unused TOTP step.
  test.setTimeout(120_000)
  const {secret, lastStep} = loadOwnerTotp()
  owner = await (await browser.newContext({viewport: VIEWPORT})).newPage()
  await owner.goto(`${ADMIN}/login`)
  await signInWithCode(owner, OWNER)
  // admin.spec.ts has finished: one step past its last one is never a replay.
  const step = Math.max(Math.floor(Date.now() / 30_000), lastStep + 1)
  while (step > Math.floor(Date.now() / 30_000) + 1) await owner.waitForTimeout(1000)
  await owner.getByLabel('Code from the app').fill(generateSync({secret, epoch: step * 30}))
  await owner.getByRole('button', {name: 'Verify'}).click()
  await expect(owner.getByRole('heading', {name: /^Welcome/})).toBeVisible()
  await setVipRevoke(REVOKE)
})

test.afterAll(async () => {
  // beforeAll may have failed before the owner page existed: then there is nothing to undo.
  const page = owner as Page | undefined
  if (!page) return
  try {
    // Leave the VIP product as seeded.
    await setVipRevoke('')
  } catch (error) {
    console.error('refund.spec.ts: could not clear the VIP revoke command', error)
  } finally {
    await page.context().close()
  }
})

/** Opens the order in the admin through the search and returns its admin id. */
async function openOrder(publicId: string) {
  await owner.goto(`${ADMIN}/orders`)
  const search = owner.getByLabel('Search by nick, email or order number')
  await search.fill(publicId)
  await search.press('Enter')
  const row = owner.getByRole('table', {name: 'Orders'}).getByRole('row').filter({
    hasText: publicId
  })
  await expect(row).toHaveCount(1)
  await row.getByRole('cell').nth(1).click()
  await expect(owner).toHaveURL(/\/orders\/\w+$/)
  return new URL(owner.url()).pathname.split('/').at(-1) ?? ''
}

/** The order's delivery of `kind` (Grant, Revoke, Restore) on the open admin order page. */
function delivery(kind: string) {
  // Each delivery is a section inside the card's section: take the innermost.
  return owner
    .locator('section')
    .filter({hasNot: owner.locator('section')})
    .filter({has: owner.getByText(kind, {exact: true})})
}

/** Reloads the admin order page until its delivery of `kind` shows `status`. */
async function waitForDelivery(kind: string, status: string) {
  await expect(async () => {
    await owner.reload()
    await expect(delivery(kind).getByText(status, {exact: true})).toBeVisible({timeout: 2_000})
  }).toPass({timeout: 45_000, intervals: [1_000]})
}

/** Sends the order's charge a refund or dispute event through the fake gateway (e2e only). */
async function chargeEvent(request: APIRequestContext, publicId: string, kind: string) {
  const res = await request.post(`${WEB}/api/payments/fake/orders/${publicId}/events/${kind}`)
  expect(res.status()).toBe(201)
}

test('the owner refunds a delivered order and the items are taken back', async ({
  page,
  request
}) => {
  test.setTimeout(180_000)
  const player = nick('E2e_Rf')
  const publicId = await buyVip(page, {
    nick: player,
    email: `refund-${String(Date.now())}@shop.localhost`
  })
  await expect(page.getByText(DELIVERED)).toBeVisible({timeout: 30_000})

  await openOrder(publicId)
  await owner.getByRole('button', {name: 'Refund', exact: true}).click()
  const bar = owner.getByRole('group', {name: 'Refund'})
  await expect(bar.getByLabel('Take the delivered items back')).toBeChecked()
  await bar.getByRole('button', {name: 'Confirm refund'}).click()
  await expect(owner.getByText('Refund requested, waiting for Stripe')).toBeVisible()
  // The order changes only on the Stripe event: nothing is taken back yet.
  await expect(delivery('Revoke')).toHaveCount(0)

  await chargeEvent(request, publicId, 'refunded')
  await page.reload()
  await expect(page.getByRole('heading', {name: 'This order was refunded'})).toBeVisible()
  // The worker sends the product's current revoke command to the fake RCON server.
  await waitForDelivery('Revoke', 'Done')
  await expect(delivery('Revoke')).toContainText(`say [demo] ${player} lost vip`)
  await expect(owner.getByText('This order was refunded')).toBeVisible()
})

let disputed = {publicId: '', orderId: ''}

test('a dispute takes the items back, mails the owner and a won dispute restores them', async ({
  page,
  request
}) => {
  test.setTimeout(180_000)
  const player = nick('E2e_Dp')
  const publicId = await buyVip(page, {
    nick: player,
    email: `dispute-${String(Date.now())}@shop.localhost`
  })
  await expect(page.getByText(DELIVERED)).toBeVisible({timeout: 30_000})
  const orderId = await openOrder(publicId)

  await chargeEvent(request, publicId, 'dispute_opened')
  await page.reload()
  await expect(page.getByRole('heading', {name: 'This payment is under review'})).toBeVisible()
  const mail = await findMail(OWNER, {
    subject: `Dispute opened for order ${publicId}`,
    text: player
  })
  expect(mail.text).toContain(publicId)
  await waitForDelivery('Revoke', 'Done')
  await expect(owner.getByText('The buyer disputed this payment')).toBeVisible()

  await chargeEvent(request, publicId, 'dispute_won')
  // The restore runs the grant's stored commands; once it is done the order is delivered again.
  await waitForDelivery('Restore', 'Done')
  await expect(delivery('Restore')).toContainText(`say [demo] ${player} bought vip`)
  await expect(async () => {
    await owner.reload()
    // The order's status pill in the page header.
    await expect(owner.locator('main header').getByText('Delivered', {exact: true})).toBeVisible({
      timeout: 2_000
    })
  }).toPass({timeout: 30_000, intervals: [1_000]})
  await page.reload()
  await expect(page.getByText(DELIVERED)).toBeVisible({timeout: 30_000})
  disputed = {publicId, orderId}
})

test('an ADMIN without order.refund sees no refund button and the API answers 403', async ({
  browser
}) => {
  test.setTimeout(180_000)
  // The order the dispute test left delivered: refundable, so only the permission stops it.
  expect(disputed.orderId).not.toBe('')
  const email = `refund-admin-${String(Date.now())}@shop.localhost`
  await owner.goto(`${ADMIN}/team`)
  await owner.getByRole('tab', {name: 'Invites'}).click()
  await owner.getByLabel('Email', {exact: true}).fill(email)
  await owner.getByRole('combobox', {name: 'Role', exact: true}).click()
  await owner.getByRole('option', {name: 'ADMIN', exact: true}).click()
  await owner.getByRole('button', {name: 'Send invite'}).click()
  await expect(owner.getByText(`Invite sent to ${email}.`)).toBeVisible()

  const context = await browser.newContext({viewport: VIEWPORT})
  const admin = await context.newPage()
  await admin.goto(inviteLink(await latestMail(email)))
  await signInWithCode(admin, email)
  await setUpTotp(admin)
  await admin.goto(`${ADMIN}/orders/${disputed.orderId}`)
  await expect(admin.getByRole('heading', {name: `Order ${disputed.publicId}`})).toBeVisible()
  await expect(admin.getByRole('button', {name: 'Refund', exact: true})).toHaveCount(0)
  // The same call the button makes, with the ADMIN's signed-in, TOTP-verified session.
  const res = await admin.request.post(`${ADMIN}/api/admin/orders/${disputed.orderId}/refund`, {
    data: {revoke: true},
    headers: {origin: ADMIN}
  })
  expect(res.status()).toBe(403)
  await context.close()

  // Nothing was reserved: the owner still has the button.
  await owner.goto(`${ADMIN}/orders/${disputed.orderId}`)
  await expect(owner.getByRole('button', {name: 'Refund', exact: true})).toBeVisible()
})

test('a stuck delivery blocks the refund until the owner marks it done on Deliveries', async ({
  page
}) => {
  test.setTimeout(180_000)
  // With "Silent" in the nick the grant command contains "silent", which the fake RCON server never
  // answers: the delivery ends NEEDS_REVIEW after the 10 s timeout.
  const publicId = await buyVip(page, {
    nick: nick('Silent_Rf'),
    email: `refund-silent-${String(Date.now())}@shop.localhost`
  })
  await expect(
    page.getByText('Delivery is delayed, we are on it. You do not need to do anything.')
  ).toBeVisible({timeout: 60_000})

  await openOrder(publicId)
  await expect(delivery('Grant').getByText('Needs review', {exact: true})).toBeVisible()
  await owner.getByRole('button', {name: 'Refund', exact: true}).click()
  await owner
    .getByRole('group', {name: 'Refund'})
    .getByRole('button', {name: 'Confirm refund'})
    .click()
  await expect(
    owner.getByText("Resolve the order's running or stuck deliveries first.")
  ).toBeVisible()

  await owner.goto(`${ADMIN}/deliveries`)
  const row = owner.getByRole('table', {name: 'Deliveries'}).getByRole('row').filter({
    hasText: publicId
  })
  await expect(row).toHaveCount(1)
  await expect(row).toContainText('Needs review')
  await row.getByRole('button', {name: 'Mark as done'}).click()
  await row.getByRole('button', {name: 'Yes, mark as done'}).click()
  await expect(owner.getByText('Delivery marked as done')).toBeVisible()
  await expect(row).toHaveCount(0)
  // The player's page still polls while delivery is delayed: it flips without a reload.
  await expect(page.getByText(DELIVERED)).toBeVisible({timeout: 30_000})
})
