import {renderWithStore} from '@/test/render-with-store'
import {screen} from '@testing-library/react'
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
  createdAt: '2026-10-12T09:30:00.000Z',
  paidAt: '2026-10-12T09:35:00.000Z',
  deliveryConsentAt: '2026-10-12T09:29:00.000Z',
  locale: 'en',
  stripeSessionId: 'cs_test_123',
  stripePaymentIntentId: 'pi_test_456',
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
})
