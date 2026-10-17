export const stripeSessionUrl = (sessionId: string) =>
  `https://dashboard.stripe.com/test/checkout/sessions/${sessionId}`
