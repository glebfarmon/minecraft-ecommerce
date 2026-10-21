/**
 * The payment in the Stripe dashboard. Checkout Sessions have no dashboard page (that URL lands on
 * the dashboard home), payments do. Test or live comes from the session id; the e2e's fake gateway
 * (`cs_fake_…`) has nothing in Stripe to open.
 */
export function stripePaymentUrl(sessionId: string | null, paymentIntentId: string | null) {
  const mode = /^cs_(test|live)_/.exec(sessionId ?? '')?.[1]
  if (!mode || !paymentIntentId) return null
  return `https://dashboard.stripe.com/${mode === 'test' ? 'test/' : ''}payments/${paymentIntentId}`
}
