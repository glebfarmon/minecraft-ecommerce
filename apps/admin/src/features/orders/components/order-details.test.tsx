import {renderWithStore} from '@/test/render-with-store'
import {findToast} from '@/test/toast'
import {screen, waitFor, within} from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import {OrderDetails} from './order-details'

const base = {
  id: 'o1',
  publicId: 'SHOP-o1',
  status: 'PAID',
  nick: 'steve',
  email: 'steve@example.com',
  currency: 'EUR',
  totalMinor: 1500,
  subtotalMinor: 2000,
  discountMinor: 500,
  promoCode: null,
  createdAt: '2026-10-12T09:30:00.000Z',
  paidAt: '2026-10-12T09:35:00.000Z',
  deliveryConsentAt: '2026-10-12T09:29:00.000Z',
  locale: 'en',
  stripeSessionId: 'cs_test_123',
  stripePaymentIntentId: 'pi_test_456',
  delivery: 'none',
  deliveries: [],
  servers: [
    {
      serverName: 'Survival',
      items: [{productName: 'VIP', quantity: 2, unitAmountMinor: 1000}]
    },
    {
      serverName: 'Creative',
      items: [{productName: 'Fly', quantity: 1, unitAmountMinor: 0}]
    }
  ]
}

const mock = (o: object) =>
  jest.spyOn(global, 'fetch').mockResolvedValue(Response.json({...base, ...o}))

describe('OrderDetails', () => {
  it('shows items grouped by server, total, email and consent time', async () => {
    mock({})
    renderWithStore(<OrderDetails id="o1" />)
    expect(await screen.findByText('Survival')).toBeInTheDocument()
    expect(screen.getByText('Creative')).toBeInTheDocument()
    expect(screen.getByText(/VIP/)).toBeInTheDocument()
    expect(screen.getByText('€15.00')).toBeInTheDocument()
    expect(screen.getByText('steve@example.com')).toBeInTheDocument()
    expect(screen.getByText('2026-10-12 09:29 UTC')).toBeInTheDocument()
  })

  it('shows the promo code next to the discount', async () => {
    mock({promoCode: 'ASF14'})
    renderWithStore(<OrderDetails id="o1" />)
    const code = await screen.findByText('ASF14')
    expect(code.closest('dt')).toHaveTextContent('Discount ASF14')
    expect(screen.getByText('€5.00')).toBeInTheDocument()
  })

  it('shows no code for an order without one', async () => {
    mock({})
    renderWithStore(<OrderDetails id="o1" />)
    expect(await screen.findByText('€5.00')).toBeInTheDocument()
    expect(screen.getByText('Discount').tagName).toBe('DT')
  })

  it('copies the buyer email and confirms with a toast', async () => {
    mock({})
    const user = userEvent.setup()
    const writeText = jest.spyOn(navigator.clipboard, 'writeText')
    renderWithStore(<OrderDetails id="o1" />)
    await user.click(await screen.findByRole('button', {name: 'Copy email'}))
    expect(writeText).toHaveBeenCalledWith('steve@example.com')
    expect(await screen.findByRole('status')).toHaveTextContent('Email copied')
  })

  it('links the payment in the Stripe dashboard, which has no page for a session', async () => {
    mock({})
    renderWithStore(<OrderDetails id="o1" />)
    const link = await screen.findByRole('link', {name: /pi_test_456/})
    expect(link).toHaveAttribute('href', 'https://dashboard.stripe.com/test/payments/pi_test_456')
    expect(link).toHaveAttribute('target', '_blank')
    expect(link).toHaveAttribute('rel', 'noopener noreferrer')
    expect(screen.getByText('cs_test_123')).toBeInTheDocument()
  })

  it('links a live payment without the test path', async () => {
    mock({stripeSessionId: 'cs_live_1', stripePaymentIntentId: 'pi_1'})
    renderWithStore(<OrderDetails id="o1" />)
    expect(await screen.findByRole('link', {name: /pi_1/})).toHaveAttribute(
      'href',
      'https://dashboard.stripe.com/payments/pi_1'
    )
  })

  it('shows an unpaid order, or one from the fake gateway, without a Stripe link', async () => {
    mock({stripePaymentIntentId: null})
    const {unmount} = renderWithStore(<OrderDetails id="o1" />)
    await screen.findByText('Survival')
    expect(screen.queryByRole('link', {name: /pi_/})).not.toBeInTheDocument()
    expect(screen.getByText('Stripe payment').nextElementSibling).toHaveTextContent('—')
    unmount()
    jest.restoreAllMocks()
    mock({stripeSessionId: 'cs_fake_1', stripePaymentIntentId: 'pi_fake_1'})
    renderWithStore(<OrderDetails id="o1" />)
    expect(await screen.findByText('pi_fake_1')).toBeInTheDocument()
    expect(screen.queryByRole('link', {name: /pi_fake_1/})).not.toBeInTheDocument()
  })

  it('shows a dash when there is no Stripe session', async () => {
    mock({stripeSessionId: null})
    renderWithStore(<OrderDetails id="o1" />)
    await screen.findByText('Survival')
    expect(screen.getByText('Stripe session').nextElementSibling).toHaveTextContent('—')
  })

  describe('deliveries', () => {
    const delivery = (o: object) => ({
      id: 'd1',
      kind: 'GRANT',
      status: 'DONE',
      serverName: 'Survival',
      productName: 'VIP',
      commands: ['lp user steve parent add vip', 'give steve diamond 1'],
      commandsDone: 1,
      attempts: 2,
      nextAttemptAt: '2026-10-12T10:00:00.000Z',
      lastError: null,
      replies: ['Added steve to vip'],
      createdAt: '2026-10-12T09:36:00.000Z',
      ...o
    })

    function mockWrites(deliveries: object[]) {
      const writes: {method: string; url: string}[] = []
      jest.spyOn(global, 'fetch').mockImplementation((input, init) => {
        const req = input instanceof Request ? input : new Request(String(input), init)
        if (req.method !== 'GET') {
          writes.push({method: req.method, url: new URL(req.url).pathname})
          return Promise.resolve(Response.json(deliveries[0]))
        }
        return Promise.resolve(Response.json({...base, deliveries}))
      })
      return writes
    }

    it('lists commands with the sent ones marked, replies, error and status', async () => {
      mockWrites([delivery({status: 'FAILED', lastError: 'RCON timeout'})])
      renderWithStore(<OrderDetails id="o1" canResolve />)
      const card = (await screen.findByRole('heading', {name: 'Deliveries'})).closest(
        'section'
      ) as HTMLElement
      expect(within(card).getByText('Grant')).toBeInTheDocument()
      expect(within(card).getByText('Failed')).toBeInTheDocument()
      expect(within(card).getByText('Attempts: 2')).toBeInTheDocument()
      expect(within(card).getByText('RCON timeout')).toBeInTheDocument()
      expect(within(card).getByText('Added steve to vip')).toBeInTheDocument()
      const [first, second] = within(card).getAllByRole('listitem')
      expect(first).toHaveTextContent('lp user steve parent add vip')
      expect(first).toHaveTextContent('sent')
      expect(second).toHaveTextContent('not sent')
      expect(within(card).queryByText(/Next attempt/)).not.toBeInTheDocument()
    })

    it('shows the next attempt only while pending', async () => {
      mockWrites([delivery({status: 'PENDING'})])
      renderWithStore(<OrderDetails id="o1" />)
      expect(await screen.findByText(/Next attempt 2026-10-12 10:00 UTC/)).toBeInTheDocument()
    })

    it('shows retry and mark as done only for stuck deliveries and with the permission', async () => {
      mockWrites([delivery({status: 'FAILED'})])
      const {unmount} = renderWithStore(<OrderDetails id="o1" canResolve />)
      expect(await screen.findByRole('button', {name: 'Retry'})).toBeInTheDocument()
      expect(screen.getByRole('button', {name: 'Mark as done'})).toBeInTheDocument()
      unmount()
      jest.restoreAllMocks()
      mockWrites([delivery({status: 'FAILED'})])
      const second = renderWithStore(<OrderDetails id="o1" />)
      await screen.findByText('Failed')
      expect(screen.queryByRole('button', {name: 'Retry'})).not.toBeInTheDocument()
      expect(screen.queryByRole('button', {name: 'Mark as done'})).not.toBeInTheDocument()
      second.unmount()
      jest.restoreAllMocks()
      mockWrites([delivery({status: 'DONE'})])
      renderWithStore(<OrderDetails id="o1" canResolve />)
      await screen.findByText('Done')
      expect(screen.queryByRole('button', {name: 'Retry'})).not.toBeInTheDocument()
    })

    it('retries a failed delivery directly and toasts', async () => {
      const writes = mockWrites([delivery({status: 'FAILED'})])
      const user = userEvent.setup()
      renderWithStore(<OrderDetails id="o1" canResolve />)
      await user.click(await screen.findByRole('button', {name: 'Retry'}))
      await waitFor(() => {
        expect(writes).toEqual([{method: 'POST', url: '/api/admin/deliveries/d1/retry'}])
      })
      expect(await findToast()).toHaveTextContent('Delivery queued again')
    })

    it('asks before retrying a delivery that needs review', async () => {
      const writes = mockWrites([delivery({status: 'NEEDS_REVIEW'})])
      const user = userEvent.setup()
      renderWithStore(<OrderDetails id="o1" canResolve />)
      await user.click(await screen.findByRole('button', {name: 'Retry'}))
      expect(writes).toEqual([])
      expect(screen.getByText(/may already have run/)).toBeInTheDocument()
      await user.click(screen.getByRole('button', {name: 'Retry anyway'}))
      await waitFor(() => {
        expect(writes).toEqual([{method: 'POST', url: '/api/admin/deliveries/d1/retry'}])
      })
    })

    it('cancels the review confirm without calling the API', async () => {
      const writes = mockWrites([delivery({status: 'NEEDS_REVIEW'})])
      const user = userEvent.setup()
      renderWithStore(<OrderDetails id="o1" canResolve />)
      await user.click(await screen.findByRole('button', {name: 'Retry'}))
      await user.click(screen.getByRole('button', {name: 'Cancel'}))
      expect(screen.queryByText(/may already have run/)).not.toBeInTheDocument()
      expect(writes).toEqual([])
    })

    it('confirms mark as done before calling the API', async () => {
      const writes = mockWrites([delivery({status: 'FAILED'})])
      const user = userEvent.setup()
      renderWithStore(<OrderDetails id="o1" canResolve />)
      await user.click(await screen.findByRole('button', {name: 'Mark as done'}))
      expect(writes).toEqual([])
      await user.click(screen.getByRole('button', {name: 'Yes, mark as done'}))
      await waitFor(() => {
        expect(writes).toEqual([{method: 'POST', url: '/api/admin/deliveries/d1/mark-done'}])
      })
    })
  })
})
