import {
  AdminOrderPageSchema,
  AdminOrderQuerySchema,
  AdminOrderSchema,
  CreateOrderRequestSchema,
  CreateOrderResponseSchema,
  OrderStatsQuerySchema,
  OrderStatsSchema,
  PublicOrderSchema
} from '@shop/shared/orders'

import {type Method, type Operation, body, guarded, json, pathParam, queryParam} from './helpers'

const NO_SESSION = 'No session needed.'

const publicOp = (o: Omit<Operation, 'tags'>): Operation => ({...o, tags: ['Orders']})
const adminOp = (o: Omit<Operation, 'tags'>): Operation => ({...o, tags: ['Orders admin']})
const paymentsOp = (o: Omit<Operation, 'tags'>): Operation => ({...o, tags: ['Payments']})

// The fake payment routes (`/api/payments/fake/*`) are deliberately left out: they exist only
// for e2e runs (PAYMENTS_GATEWAY=fake) and answer 404 under Stripe. They are not under
// `/api/admin`, so `admin-routes.spec.ts` does not look for them either.
export const ordersPaths: Record<string, Partial<Record<Method, Operation>>> = {
  '/api/orders': {
    post: publicOp({
      operationId: 'createOrder',
      summary: 'Start a checkout: price the cart and get the payment page URL',
      description: `Prices the lines from the database (the client sends only server, slug and quantity), stores a pending order and opens a hosted payment session. Redirect the browser to \`redirectUrl\`. Needs a Turnstile token. ${NO_SESSION}`,
      requestBody: body(CreateOrderRequestSchema),
      responses: {
        '201': json(
          'The order was created; send the buyer to `redirectUrl`',
          CreateOrderResponseSchema
        ),
        '400': {
          description:
            'Invalid body, or `turnstile_failed`: the bot check did not pass (ask the buyer to retry)'
        },
        '409': {
          description:
            '`unavailable`: some lines can no longer be sold; `issues.lines` lists them (server and slug)'
        },
        '429': {description: 'Too many orders from this address; try again later'},
        '502': {
          description:
            '`payments_unavailable`: the payment provider could not open a session; nothing was charged'
        }
      }
    })
  },
  '/api/orders/{publicId}': {
    get: publicOp({
      operationId: 'getPublicOrder',
      summary: 'Status and contents of one order, for the buyer’s return page',
      description: `Looked up by the unguessable public id from the order link. The email is masked. ${NO_SESSION} Never cached.`,
      parameters: [pathParam('publicId')],
      responses: {
        '200': json('The order', PublicOrderSchema),
        '404': {description: '`not_found`: no such order, or the id is malformed'}
      }
    })
  },
  '/api/webhooks/stripe': {
    post: paymentsOp({
      operationId: 'stripeWebhook',
      summary: 'Stripe payment events',
      description:
        'Called by Stripe. Verifies `Stripe-Signature` against the raw body; replays and duplicates are acknowledged with 200 and change nothing.',
      responses: {
        '200': {description: 'Event accepted (or already applied)'},
        '400': {description: '`invalid_signature`: missing or wrong `Stripe-Signature`'}
      }
    })
  },
  '/api/admin/orders': {
    get: adminOp({
      operationId: 'listAdminOrders',
      summary: 'Orders, newest first, 50 per page',
      description:
        'Needs `order.read`. `q` matches a nick prefix (any case), an exact email (any case) or an exact public id. `status` narrows by order status. Pass the returned `nextCursor` as `cursor` for the next page.',
      parameters: Object.entries(AdminOrderQuerySchema.entries).map(([name, s]) =>
        queryParam(name, s.wrapped)
      ),
      responses: {
        '200': json('A page of orders', AdminOrderPageSchema),
        '400': {description: 'Invalid filter, for example an unknown status'},
        ...guarded
      }
    })
  },
  '/api/admin/orders/{id}': {
    get: adminOp({
      operationId: 'getAdminOrder',
      summary: 'One order with the full email and payment details',
      description:
        'Needs `order.read`. Includes the unmasked email, the payment session id, the time the buyer consented to delivery, and the subtotal and discount.',
      parameters: [pathParam('id')],
      responses: {
        '200': json('The order', AdminOrderSchema),
        '404': {description: '`not_found`: no such order'},
        ...guarded
      }
    })
  },
  '/api/admin/stats/orders': {
    get: adminOp({
      operationId: 'getOrderStats',
      summary: 'Order and revenue statistics for the dashboard',
      description:
        'Needs `order.read`. `range` is `7d` (default) or `30d`, ending now; days are UTC. `currency` (`EUR` default or `PLN`) is the reporting currency: revenue, average order, LTV and the daily series are sums of the totals stored on each order when it was paid, converted at the NBP rate of the previous business day. Revenue counts PAID and DELIVERED orders by payment time; `previous*` cover the same-length range before, converted the same way. Paid orders still without a rate are left out of those figures and counted in `awaitingRate` (`previousAwaitingRate` for the previous range); `averageMinor` and `ltvMinor` are `null` when no order has a rate. `ltvMinor` is revenue per distinct buyer email (case-insensitive). `byCurrency` splits paid orders by the currency they were paid in, with sums in that original currency. `conversion` is paid ÷ (paid + expired) over orders created in the range, `null` when there are none.',
      parameters: [
        queryParam('range', OrderStatsQuerySchema.entries.range.wrapped),
        queryParam('currency', OrderStatsQuerySchema.entries.currency.wrapped)
      ],
      responses: {
        '200': json('Statistics for the range', OrderStatsSchema),
        '400': {description: 'Unknown range or currency'},
        ...guarded
      }
    })
  }
}
