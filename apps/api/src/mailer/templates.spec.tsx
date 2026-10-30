import type {PublicOrder} from '@shop/shared/orders'

import {
  deliveryAlertMail,
  inviteMail,
  orderReceiptMail,
  signInCodeMail,
  twoFactorResetMail
} from './templates'

const order: PublicOrder = {
  publicId: 'AbCdEfGhIjKlMnOpQrStUv',
  status: 'PAID',
  nick: 'Steve_1',
  email: 's***@example.com',
  currency: 'EUR',
  subtotalMinor: 499,
  discountMinor: 0,
  promoCode: null,
  totalMinor: 499,
  servers: [
    {serverName: 'Survival', items: [{productName: 'VIP', quantity: 1, unitAmountMinor: 299}]},
    {
      serverName: 'Skyblock',
      items: [{productName: 'Island key', quantity: 2, unitAmountMinor: 100}]
    }
  ],
  createdAt: '2026-10-16T10:00:00.000Z',
  paidAt: '2026-10-16T10:01:00.000Z',
  delivery: 'none'
}
const statusUrl = 'http://shop.test/order/AbCdEfGhIjKlMnOpQrStUv'
const eur = (locale: string, minor: number) =>
  new Intl.NumberFormat(locale, {style: 'currency', currency: 'EUR'}).format(minor / 100)

describe('mail templates', () => {
  it('puts the code in the subject, html and text of the sign-in mail', async () => {
    const mail = await signInCodeMail('482913', 'BlockHaus')
    expect(mail.subject).toContain('482913')
    expect(mail.html).toContain('482913')
    expect(mail.text).toContain('482913')
  })
  it('links the invite and names the role', async () => {
    const mail = await inviteMail('https://admin.example.com/invite/abc', 'ADMIN', 'BlockHaus')
    expect(mail.html).toContain('https://admin.example.com/invite/abc')
    expect(mail.text).toContain('ADMIN')
  })
  it('names the site, never "Shop Admin", in every admin mail', async () => {
    const mails = [
      await signInCodeMail('482913', 'BlockHaus'),
      await inviteMail('https://admin.example.com/invite/abc', 'ADMIN', 'BlockHaus'),
      await twoFactorResetMail('BlockHaus')
    ]
    expect(mails[0]?.subject).toBe('482913 is your BlockHaus Admin sign-in code')
    expect(mails[1]?.subject).toBe('You are invited to BlockHaus Admin')
    expect(mails[2]?.subject).toBe('Your BlockHaus Admin two-factor authentication was reset')
    for (const m of mails) {
      expect(m.subject + m.html + m.text).not.toContain('Shop Admin')
    }
  })
  it('tells the person their 2FA was reset', async () => {
    expect((await twoFactorResetMail('BlockHaus')).text).toMatch(/two-factor/i)
  })

  describe('orderReceiptMail', () => {
    it('lists every product, the total and the status link in English', async () => {
      const mail = await orderReceiptMail(order, 'en', statusUrl)
      expect(mail.subject).toBe(`Your order ${order.publicId} is paid`)
      for (const name of ['VIP', 'Island key', 'Survival', 'Skyblock'])
        expect(mail.text).toContain(name)
      expect(mail.text).toContain(eur('en', 499))
      expect(mail.text).toContain(statusUrl)
      expect(mail.html).toContain(statusUrl)
      expect(mail.html).toContain('lang="en"')
      expect(mail.html).toContain('Thank you, Steve_1!')
    })

    it('speaks Polish to a pl order', async () => {
      const mail = await orderReceiptMail(order, 'pl', 'http://shop.test/pl/order/x')
      expect(mail.subject).toBe(`Zamówienie ${order.publicId} opłacone`)
      expect(mail.html).toContain('Dziękujemy, Steve_1!')
      expect(mail.text).toContain(eur('pl', 499))
      expect(mail.html).toContain('lang="pl"')
    })

    const discounted: PublicOrder = {
      ...order,
      subtotalMinor: 499,
      discountMinor: 240,
      promoCode: 'ASF14',
      totalMinor: 259
    }
    it('shows the promo row between the lines and the total in English', async () => {
      const mail = await orderReceiptMail(discounted, 'en', statusUrl)
      expect(mail.text).toContain(`Promo code ASF14`)
      expect(mail.text).toContain(`\u2212${eur('en', 240)}`)
      expect(mail.text).toContain(eur('en', 259))
    })
    it('shows the promo row in Polish', async () => {
      const mail = await orderReceiptMail(discounted, 'pl', statusUrl)
      expect(mail.text).toContain('Kod promocyjny ASF14')
      expect(mail.text).toContain(`\u2212${eur('pl', 240)}`)
    })
    it('has no promo row without a discount', async () => {
      for (const locale of ['en', 'pl'] as const) {
        const mail = await orderReceiptMail(order, locale, statusUrl)
        expect(mail.text).not.toMatch(/Promo code|Kod promocyjny/)
      }
    })
  })
})

describe('deliveryAlertMail', () => {
  it('renders delivery id, kind, order id, nick, server, status and the admin link', async () => {
    const mail = await deliveryAlertMail(
      [
        {
          deliveryId: 'cdelivery000000000000001',
          kind: 'GRANT',
          orderPublicId: 'AbCdEfGhIjKlMnOpQrStUv',
          nick: 'Steve_1',
          serverName: 'Survival',
          status: 'FAILED',
          lastError: 'connection refused'
        },
        {
          deliveryId: 'cdelivery000000000000002',
          kind: 'GRANT',
          orderPublicId: 'ZzZzZzZzZzZzZzZzZzZzZz',
          nick: 'Alex',
          serverName: 'Skyblock',
          status: 'NEEDS_REVIEW',
          lastError: null
        }
      ],
      'http://admin.test/orders'
    )
    expect(mail.subject).toBe('Delivery needs attention (2)')
    for (const part of [
      'cdelivery000000000000001',
      'cdelivery000000000000002',
      'GRANT',
      'AbCdEfGhIjKlMnOpQrStUv',
      'Steve_1',
      'Survival',
      'FAILED',
      'connection refused',
      'ZzZzZzZzZzZzZzZzZzZzZz',
      'Skyblock',
      'NEEDS_REVIEW',
      'http://admin.test/orders'
    ]) {
      expect(mail.text).toContain(part)
      expect(mail.html).toContain(part)
    }
  })

  it('describes a REVOKE without an order by its nick and server', async () => {
    const mail = await deliveryAlertMail(
      [
        {
          deliveryId: 'crevoke00000000000000001',
          kind: 'REVOKE',
          orderPublicId: null,
          nick: 'Alex',
          serverName: 'Skyblock',
          status: 'FAILED',
          lastError: 'connection refused'
        }
      ],
      'http://admin.test/orders'
    )
    for (const part of ['revoke for Alex on Skyblock', 'crevoke00000000000000001', 'REVOKE']) {
      expect(mail.text).toContain(part)
      expect(mail.html).toContain(part)
    }
    expect(mail.text).not.toContain('grant ·')
  })
})
