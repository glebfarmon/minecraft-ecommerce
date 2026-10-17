import {renderWithStore} from '@/test/render-with-store'
import {screen} from '@testing-library/react'

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

  it('links to the Stripe session', async () => {
    mock({})
    renderWithStore(<OrderDetails id="o1" />)
    const link = await screen.findByRole('link', {name: /cs_test_123/})
    expect(link).toHaveAttribute(
      'href',
      'https://dashboard.stripe.com/test/checkout/sessions/cs_test_123'
    )
    expect(link).toHaveAttribute('target', '_blank')
    expect(link).toHaveAttribute('rel', 'noopener noreferrer')
  })

  it('shows a dash when there is no Stripe session', async () => {
    mock({stripeSessionId: null})
    renderWithStore(<OrderDetails id="o1" />)
    await screen.findByText('Survival')
    expect(screen.queryByRole('link', {name: /cs_test/})).not.toBeInTheDocument()
    expect(screen.getByText('Stripe session').nextElementSibling).toHaveTextContent('—')
  })
})
