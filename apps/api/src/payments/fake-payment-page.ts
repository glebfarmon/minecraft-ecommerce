import type {SessionRequest} from './payments-gateway'

const ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;'
}
export const escapeHtml = (value: string) => value.replace(/[&<>"']/g, c => ESCAPES[c] ?? c)

/** e2e only: a self-contained stand-in for the Stripe Checkout page. */
export function fakePaymentPage(session: SessionRequest & {id: string}): string {
  const money = new Intl.NumberFormat(session.locale, {
    style: 'currency',
    currency: session.currency
  })
  const format = (minor: number) => money.format(minor / 100)
  const total = session.lines.reduce((sum, l) => sum + l.unitAmountMinor * l.quantity, 0)
  const rows = session.lines
    .map(
      l =>
        `<li>${escapeHtml(l.name)} &times; ${escapeHtml(String(l.quantity))} &mdash; ${escapeHtml(format(l.unitAmountMinor * l.quantity))}</li>`
    )
    .join('')
  const id = encodeURIComponent(session.id)
  return `<!doctype html>
<html lang="${escapeHtml(session.locale)}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Test payment</title>
<style>body{font-family:system-ui,sans-serif;max-width:28rem;margin:3rem auto;padding:0 1rem}ul{padding-left:1.2rem}form{display:inline-block;margin-right:.5rem}button{font:inherit;padding:.5rem 1rem}</style>
</head>
<body>
<h1>Test payment</h1>
<ul>${rows}</ul>
<p><strong>Total: ${escapeHtml(format(total))}</strong></p>
<form method="post" action="/api/payments/fake/${id}/pay"><button type="submit">Pay</button></form>
<form method="post" action="/api/payments/fake/${id}/cancel"><button type="submit">Cancel</button></form>
</body>
</html>`
}
