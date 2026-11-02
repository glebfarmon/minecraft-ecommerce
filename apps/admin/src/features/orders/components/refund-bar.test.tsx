import {renderWithStore} from '@/test/render-with-store'
import {findToast} from '@/test/toast'
import {screen, waitFor} from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import {RefundBar} from './refund-bar'

const NOW = Date.parse('2026-10-30T12:00:00.000Z')
const minutesAgo = (m: number) => new Date(NOW - m * 60_000).toISOString()

type Props = Partial<React.ComponentProps<typeof RefundBar>>
const bar = (props: Props = {}) =>
  renderWithStore(
    <RefundBar
      order={{id: 'o1', stripePaymentIntentId: 'pi_1', status: 'PAID', refundRequestedAt: null}}
      canRefund
      now={NOW}
      {...props}
    />
  )

function mockRefund(response: () => Response = () => Response.json({})) {
  const bodies: unknown[] = []
  jest.spyOn(global, 'fetch').mockImplementation(async input => {
    const req = input as Request
    bodies.push({url: new URL(req.url).pathname, body: await req.json()})
    return response()
  })
  return bodies
}

describe('RefundBar', () => {
  afterEach(() => jest.restoreAllMocks())

  it('is hidden without the permission', () => {
    bar({canRefund: false})
    expect(screen.queryByRole('button', {name: 'Refund'})).not.toBeInTheDocument()
  })

  it.each(['PENDING', 'EXPIRED', 'REFUNDED', 'DISPUTED'] as const)(
    'offers no button for %s',
    status => {
      bar({order: {id: 'o1', stripePaymentIntentId: 'pi_1', status, refundRequestedAt: null}})
      expect(screen.queryByRole('button', {name: 'Refund'})).not.toBeInTheDocument()
    }
  )

  it('offers no button for an order without a Stripe payment', () => {
    bar({
      order: {id: 'o1', stripePaymentIntentId: null, status: 'PAID', refundRequestedAt: null}
    })
    expect(screen.queryByRole('button', {name: 'Refund'})).not.toBeInTheDocument()
  })

  it.each(['PAID', 'DELIVERED'] as const)('offers the button for %s', status => {
    bar({order: {id: 'o1', stripePaymentIntentId: 'pi_1', status, refundRequestedAt: null}})
    expect(screen.getByRole('button', {name: 'Refund'})).toBeInTheDocument()
  })

  it('shows plain status lines for refunded and disputed orders, even without the permission', () => {
    const {unmount} = bar({
      canRefund: false,
      order: {id: 'o1', stripePaymentIntentId: 'pi_1', status: 'REFUNDED', refundRequestedAt: null}
    })
    expect(screen.getByText('This order was refunded')).toBeInTheDocument()
    unmount()
    bar({
      canRefund: false,
      order: {id: 'o1', stripePaymentIntentId: 'pi_1', status: 'DISPUTED', refundRequestedAt: null}
    })
    expect(screen.getByText('The buyer disputed this payment')).toBeInTheDocument()
  })

  it('opens a confirm bar with the revoke checkbox checked by default', async () => {
    const user = userEvent.setup()
    bar()
    await user.click(screen.getByRole('button', {name: 'Refund'}))
    expect(screen.getByRole('checkbox', {name: 'Take the delivered items back'})).toBeChecked()
    expect(
      screen.getByText('Products without revoke commands keep their items')
    ).toBeInTheDocument()
  })

  it('cancel closes the bar without calling the API', async () => {
    const bodies = mockRefund()
    const user = userEvent.setup()
    bar()
    await user.click(screen.getByRole('button', {name: 'Refund'}))
    await user.click(screen.getByRole('button', {name: 'Cancel'}))
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
    expect(bodies).toEqual([])
  })

  it('confirm posts revoke: true by default', async () => {
    const bodies = mockRefund()
    const user = userEvent.setup()
    bar()
    await user.click(screen.getByRole('button', {name: 'Refund'}))
    await user.click(screen.getByRole('button', {name: 'Confirm refund'}))
    await waitFor(() => {
      expect(bodies).toEqual([{url: '/api/admin/orders/o1/refund', body: {revoke: true}}])
    })
    expect(await findToast()).toHaveTextContent('Refund requested')
  })

  it('confirm posts revoke: false when unchecked', async () => {
    const bodies = mockRefund()
    const user = userEvent.setup()
    bar()
    await user.click(screen.getByRole('button', {name: 'Refund'}))
    await user.click(screen.getByRole('checkbox', {name: 'Take the delivered items back'}))
    await user.click(screen.getByRole('button', {name: 'Confirm refund'}))
    await waitFor(() => {
      expect(bodies).toEqual([{url: '/api/admin/orders/o1/refund', body: {revoke: false}}])
    })
  })

  it('translates an API refusal', async () => {
    mockRefund(() => Response.json({message: 'refund_delivery_open'}, {status: 409}))
    const user = userEvent.setup()
    bar()
    await user.click(screen.getByRole('button', {name: 'Refund'}))
    await user.click(screen.getByRole('button', {name: 'Confirm refund'}))
    expect(await screen.findByRole('alert')).toHaveTextContent(
      "Resolve the order's running or stuck deliveries first."
    )
  })

  it('waits for Stripe while the reservation is under 15 minutes old', () => {
    bar({
      order: {
        id: 'o1',
        stripePaymentIntentId: 'pi_1',
        status: 'PAID',
        refundRequestedAt: minutesAgo(14)
      }
    })
    expect(screen.getByText('Refund requested, waiting for Stripe')).toBeInTheDocument()
    expect(screen.queryByRole('button', {name: 'Refund'})).not.toBeInTheDocument()
  })

  it('offers the button again after 15 minutes', () => {
    bar({
      order: {
        id: 'o1',
        stripePaymentIntentId: 'pi_1',
        status: 'PAID',
        refundRequestedAt: minutesAgo(15)
      }
    })
    expect(screen.queryByText('Refund requested, waiting for Stripe')).not.toBeInTheDocument()
    expect(screen.getByRole('button', {name: 'Refund'})).toBeInTheDocument()
  })
})
