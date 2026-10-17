import {DEFAULT_CURRENCY} from '@/config/currencies'
import {PENDING_ORDER_KEY} from '@/config/order'
import {ShopProvider, useCart, useCartActions} from '@/features/cart/shop-provider'
import {CatalogProvider} from '@/features/catalog/catalog-provider'
import {TEST_CATALOG, renderWithCatalog} from '@/features/catalog/test-catalog'
import {createOrder} from '@/features/checkout/api/create-order'
import {redirectTo} from '@/features/checkout/lib/redirect'
import {fireEvent, screen, waitFor} from '@testing-library/react'
import {MotionGlobalConfig} from 'motion/react'
import {useEffect} from 'react'
import type {ReactNode} from 'react'

import type {CatalogProduct} from '@shop/shared/catalog'

import {TurnstileKeyProvider} from '../turnstile-key'
import {CheckoutModal} from './checkout-modal'

jest.mock('@/features/checkout/api/create-order')
jest.mock('@/features/checkout/lib/redirect')
const createOrderMock = jest.mocked(createOrder)

// The widget solves itself on mount, unless a test turns that off and clicks the stand-in button.
const mockReset = jest.fn()
let mockAutoSolve = true
jest.mock('@marsidev/react-turnstile', () => ({
  Turnstile: ({onSuccess, ref}: {onSuccess: (token: string) => void; ref?: {current: unknown}}) => {
    useEffect(() => {
      if (ref) ref.current = {reset: mockReset}
      if (mockAutoSolve) onSuccess('tok')
    }, [onSuccess, ref])
    return (
      <button
        type="button"
        onClick={() => {
          onSuccess('tok')
        }}>
        solve-captcha
      </button>
    )
  }
}))

jest.mock('next-intl', () => {
  const t = Object.assign((key: string) => key, {
    rich: (key: string, tags: Record<string, (chunks: ReactNode) => ReactNode>) => (
      <>
        {key} {tags.terms?.('terms-link')} {tags.privacy?.('privacy-link')}
      </>
    )
  })
  return {useLocale: () => 'en', useTranslations: () => t}
})

beforeAll(() => {
  MotionGlobalConfig.skipAnimations = true
})
afterAll(() => {
  MotionGlobalConfig.skipAnimations = false
})

const [first] = TEST_CATALOG.products
if (!first) throw new Error('catalog is empty')
const product: CatalogProduct = first

function Fill() {
  const {add} = useCartActions()
  return (
    <button
      type="button"
      onClick={() => {
        add(product)
        add(product)
      }}>
      fill-cart
    </button>
  )
}

function LineCount() {
  return <output data-testid="line-count">{useCart().lines.length}</output>
}

function setup({onBack = jest.fn(), onClose = jest.fn(), open = true} = {}) {
  const ui = (isOpen: boolean) => (
    <TurnstileKeyProvider siteKey="site-key">
      <ShopProvider>
        <Fill />
        <LineCount />
        <CheckoutModal open={isOpen} layoutId="cart" onBack={onBack} onClose={onClose} />
      </ShopProvider>
    </TurnstileKeyProvider>
  )
  const view = renderWithCatalog(ui(open))
  return {
    ...view,
    onBack,
    onClose,
    rerenderWith: (isOpen: boolean) => {
      // rerender replaces the whole tree, provider included.
      view.rerender(<CatalogProvider servers={TEST_CATALOG.servers}>{ui(isOpen)}</CatalogProvider>)
    }
  }
}

beforeEach(() => {
  jest.resetAllMocks()
  mockAutoSolve = true
})

const type = (label: string, value: string) => {
  fireEvent.change(screen.getByLabelText(label), {target: {value}})
}
const blur = (label: string) => {
  fireEvent.blur(screen.getByLabelText(label))
}

describe('CheckoutModal', () => {
  it('is a labelled dialog with the form fields, both consents and a disabled pay button', () => {
    setup()
    expect(screen.getByRole('dialog', {name: 'title'})).toBeInTheDocument()
    expect(screen.getByLabelText('nick.label')).toBeInTheDocument()
    expect(screen.getByLabelText('email.label')).toHaveAttribute('type', 'email')
    expect(screen.getByRole('checkbox', {name: /delivery/})).not.toBeChecked()
    expect(screen.getByRole('checkbox', {name: /terms/})).not.toBeChecked()
    expect(screen.getAllByRole('button', {name: /pay/}).length).toBeGreaterThan(0)
    for (const pay of screen.getAllByRole('button', {name: /pay/})) expect(pay).toBeDisabled()
  })

  // One Pay button sits in the summary panel (desktop), another in a bar pinned to the bottom (phones); CSS shows one.
  it('offers the pay button twice, in the summary and in the pinned bar, both with the total', () => {
    setup()
    const pays = screen.getAllByRole('button', {name: /pay/})
    expect(pays).toHaveLength(2)
    for (const pay of pays) expect(pay).toHaveAttribute('type', 'submit')
  })

  // 4a hides the promo field; 4b brings the toggle and the field back.
  it('does not render the promo toggle', () => {
    setup()
    expect(screen.queryByRole('button', {name: 'promo.toggle'})).toBeNull()
  })

  it('shows the test card hint under the pay button', () => {
    setup()
    expect(screen.getByText('payHint')).toBeInTheDocument()
  })

  it('links the terms and the privacy policy to the legal PDFs in a new tab', () => {
    setup()
    const terms = screen.getByRole('link', {name: 'terms-link'})
    const privacy = screen.getByRole('link', {name: 'privacy-link'})
    expect(terms).toHaveAttribute('href', '/legal/terms.en.pdf')
    expect(privacy).toHaveAttribute('href', '/legal/privacy.en.pdf')
    expect(terms).toHaveAttribute('target', '_blank')
    expect(terms).toHaveAttribute('rel', expect.stringContaining('noopener'))
  })

  it('reads the nickname back in the summary as it is typed', () => {
    setup()
    expect(screen.getByTestId('nick-preview')).toHaveTextContent('—')
    type('nick.label', 'Steve_42')
    expect(screen.getByTestId('nick-preview')).toHaveTextContent('Steve_42')
  })

  it('lists the cart grouped by server, with the total', () => {
    setup()
    fireEvent.click(screen.getByRole('button', {name: 'fill-cart'}))
    const summary = screen.getByRole('complementary', {name: 'summary'})
    expect(summary).toHaveTextContent(product.name)
    expect(summary).toHaveTextContent('×2')
  })

  it('shows an error under a field only after it was touched, and clears it once valid', async () => {
    setup()
    expect(screen.queryByRole('alert')).toBeNull()
    type('nick.label', 'no')
    blur('nick.label')
    expect(await screen.findByRole('alert')).toHaveTextContent('errors.nick')
    expect(screen.getByLabelText('nick.label')).toHaveAttribute('aria-invalid', 'true')
    type('nick.label', 'Steve_42')
    await waitFor(() => {
      expect(screen.queryByRole('alert')).toBeNull()
    })
  })

  it('asks for both consents before the form is valid', async () => {
    setup()
    const delivery = screen.getByRole('checkbox', {name: /delivery/})
    fireEvent.click(delivery)
    fireEvent.click(delivery)
    fireEvent.blur(delivery)
    expect(await screen.findByRole('alert')).toHaveTextContent('errors.delivery')
  })

  it('goes back with the Back button and closes with the X button', () => {
    const {onBack, onClose} = setup()
    fireEvent.click(screen.getByRole('button', {name: 'back'}))
    expect(onBack).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByRole('button', {name: 'close'}))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('keeps what was typed when the modal closes and opens again', async () => {
    const {rerenderWith} = setup()
    type('nick.label', 'Steve_42')
    type('email.label', 'steve@example.com')
    rerenderWith(false)
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull()
    })
    rerenderWith(true)
    expect(screen.getByLabelText('nick.label')).toHaveValue('Steve_42')
    expect(screen.getByLabelText('email.label')).toHaveValue('steve@example.com')
  })
  describe('paying', () => {
    const fillValid = () => {
      fireEvent.click(screen.getByRole('button', {name: 'fill-cart'}))
      type('nick.label', 'Steve_42')
      type('email.label', 'steve@example.com')
      fireEvent.click(screen.getByRole('checkbox', {name: /delivery/}))
      fireEvent.click(screen.getByRole('checkbox', {name: /terms/}))
    }
    const pay = () => {
      const [button] = screen.getAllByRole('button', {name: /pay/})
      if (!button) throw new Error('no pay button')
      return button
    }
    const submit = async () => {
      await waitFor(() => {
        expect(pay()).toBeEnabled()
      })
      fireEvent.click(pay())
    }

    it('enables pay only once the form is valid and the captcha is solved', async () => {
      mockAutoSolve = false
      setup()
      fillValid()
      await waitFor(() => {
        expect(screen.getByLabelText('email.label')).toHaveValue('steve@example.com')
      })
      expect(pay()).toBeDisabled()
      fireEvent.click(screen.getByRole('button', {name: 'solve-captcha'}))
      await waitFor(() => {
        expect(pay()).toBeEnabled()
      })
    })

    it('stays disabled with a solved captcha but an invalid form', () => {
      setup()
      expect(pay()).toBeDisabled()
    })

    it('sends the order and goes to the payment page', async () => {
      createOrderMock.mockResolvedValue({
        ok: true,
        publicId: 'ABCDEFGHJKLMNOPQRSTUVW',
        redirectUrl: 'https://pay.example/x'
      })
      setup()
      fillValid()
      await submit()
      await waitFor(() => {
        expect(redirectTo).toHaveBeenCalledWith('https://pay.example/x')
      })
      expect(localStorage.getItem(PENDING_ORDER_KEY)).toBe('ABCDEFGHJKLMNOPQRSTUVW')
      expect(createOrderMock).toHaveBeenCalledWith({
        lines: [{server: product.server, slug: product.slug, quantity: 2}],
        currency: DEFAULT_CURRENCY,
        locale: 'en',
        nick: 'Steve_42',
        email: 'steve@example.com',
        deliveryConsent: true,
        termsAccepted: true,
        turnstileToken: 'tok'
      })
    })

    it('shows the busy label and disables pay while the request runs', async () => {
      createOrderMock.mockReturnValue(new Promise(() => undefined))
      setup()
      fillValid()
      await submit()
      await waitFor(() => {
        expect(screen.getAllByRole('button', {name: 'paying'}).length).toBeGreaterThan(0)
      })
      for (const busy of screen.getAllByRole('button', {name: 'paying'}))
        expect(busy).toBeDisabled()
    })

    it('offers to remove exactly the unavailable lines', async () => {
      createOrderMock.mockResolvedValue({
        ok: false,
        error: 'unavailable',
        lines: [{server: product.server, slug: product.slug}]
      })
      setup()
      fillValid()
      await submit()
      expect(await screen.findByRole('alert')).toHaveTextContent('errors.unavailable')
      expect(screen.getByTestId('line-count')).toHaveTextContent('1')
      fireEvent.click(screen.getByRole('button', {name: 'removeUnavailable'}))
      expect(screen.getByTestId('line-count')).toHaveTextContent('0')
    })

    it('resets the widget after a failed captcha', async () => {
      createOrderMock.mockResolvedValue({ok: false, error: 'turnstile'})
      setup()
      fillValid()
      await submit()
      expect(await screen.findByRole('alert')).toHaveTextContent('errors.turnstile')
      expect(mockReset).toHaveBeenCalled()
    })

    it.each([
      ['rate_limited', 'errors.rateLimited'],
      ['unavailable_payments', 'errors.payments'],
      ['invalid', 'errors.invalid']
    ] as const)('shows %s as %s', async (error, message) => {
      createOrderMock.mockResolvedValue({ok: false, error})
      setup()
      fillValid()
      await submit()
      expect(await screen.findByRole('alert')).toHaveTextContent(message)
      // The token is spent: pay waits for the widget to hand out a new one.
      expect(pay()).toBeDisabled()
      fireEvent.click(screen.getByRole('button', {name: 'solve-captcha'}))
      await waitFor(() => {
        expect(pay()).toBeEnabled()
      })
    })
  })
})
