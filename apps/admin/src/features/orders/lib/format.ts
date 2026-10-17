export const formatTime = (iso: string) => `${iso.slice(0, 10)} ${iso.slice(11, 16)} UTC`

export const formatMoney = (amountMinor: number, currency: string) =>
  new Intl.NumberFormat('en', {style: 'currency', currency}).format(amountMinor / 100)

export const stripeSessionUrl = (sessionId: string) =>
  `https://dashboard.stripe.com/test/checkout/sessions/${sessionId}`
