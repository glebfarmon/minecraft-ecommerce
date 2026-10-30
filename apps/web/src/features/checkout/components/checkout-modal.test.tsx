import {DEFAULT_CURRENCY} from '@/config/currencies'
import {PENDING_ORDER_KEY} from '@/config/order'
import {ShopProvider, useCart, useCartActions, useCurrency} from '@/features/cart/shop-provider'
import {CatalogProvider} from '@/features/catalog/catalog-provider'
import {TEST_CATALOG, renderWithCatalog} from '@/features/catalog/test-catalog'
import {createOrder} from '@/features/checkout/api/create-order'
import {validatePromo} from '@/features/checkout/api/validate-promo'
import {redirectTo} from '@/features/checkout/lib/redirect'
import {formatPrice} from '@/lib/catalog'
import {act, fireEvent, screen, waitFor, within} from '@testing-library/react'
import {MotionGlobalConfig} from 'motion/react'
import {useEffect} from 'react'
import type {ReactNode} from 'react'

import type {CatalogProduct} from '@shop/shared/catalog'

import {TurnstileKeyProvider} from '../turnstile-key'
import {CheckoutModal} from './checkout-modal'

jest.mock('@/features/checkout/api/create-order')
jest.mock('@/features/checkout/api/validate-promo')
jest.mock('@/features/checkout/lib/redirect')
const createOrderMock = jest.mocked(createOrder)
const validatePromoMock = jest.mocked(validatePromo)

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
  // Values are appended, so a label like `pay` carries the total it was given.
  const t = Object.assign(
    (key: string, values?: Record<string, string>) =>
      values ? [key, ...Object.values(values)].join(' ') : key,
    {
      rich: (key: string, tags: Record<string, (chunks: ReactNode) => ReactNode>) => (
        <>
          {key} {tags.terms?.('terms-link')} {tags.privacy?.('privacy-link')}
        </>
      )
    }
  )
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

function CartControls() {
  const {add} = useCartActions()
  const {currency, setCurrency} = useCurrency()
  return (
    <>
      <button
        type="button"
        onClick={() => {
          add(product)
        }}>
        add-one
      </button>
      <button
        type="button"
        onClick={() => {
          setCurrency(currency === 'EUR' ? 'PLN' : 'EUR')
        }}>
        switch-currency
      </button>
    </>
  )
}

function LineCount() {
  return <output data-testid="line-count">{useCart().lines.length}</output>
}

const NO_RCON_CATALOG = {
  ...TEST_CATALOG,
  servers: TEST_CATALOG.servers.map(s => ({...s, purchasable: s.slug !== product.server}))
}

function setup({
  onBack = jest.fn(),
  onClose = jest.fn(),
  open = true,
  catalog = TEST_CATALOG
} = {}) {
  const ui = (isOpen: boolean) => (
    <TurnstileKeyProvider siteKey="site-key">
      <ShopProvider>
        <Fill />
        <LineCount />
        <CartControls />
        <CheckoutModal open={isOpen} layoutId="cart" onBack={onBack} onClose={onClose} />
      </ShopProvider>
    </TurnstileKeyProvider>
  )
  const view = renderWithCatalog(ui(open), catalog)
  return {
    ...view,
    onBack,
    onClose,
    rerenderWith: (isOpen: boolean) => {
      // rerender replaces the whole tree, provider included.
      view.rerender(<CatalogProvider servers={catalog.servers}>{ui(isOpen)}</CatalogProvider>)
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

  it('offers a collapsed promo code toggle in the summary', () => {
    setup()
    const summary = screen.getByRole('complementary', {name: 'summary'})
    expect(summary).toContainElement(screen.getByRole('button', {name: 'promo.toggle'}))
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

    it('marks lines of a server without RCON, keeps pay disabled and offers to remove them', async () => {
      setup({catalog: NO_RCON_CATALOG})
      fillValid()
      await waitFor(() => {
        expect(screen.getByLabelText('email.label')).toHaveValue('steve@example.com')
      })
      expect(screen.getByText('unavailableLine')).toBeInTheDocument()
      expect(pay()).toBeDisabled()
      fireEvent.click(screen.getByRole('button', {name: 'removeUnavailable'}))
      expect(screen.getByTestId('line-count')).toHaveTextContent('0')
    })

    it('leaves lines of a purchasable server unmarked', async () => {
      setup()
      fillValid()
      await waitFor(() => {
        expect(pay()).toBeEnabled()
      })
      expect(screen.queryByText('unavailableLine')).not.toBeInTheDocument()
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

  describe('promo code', () => {
    const eur = (minor: number) => formatPrice(minor, 'EUR', 'en').replace(/\s+/g, ' ')
    const pln = (minor: number) => formatPrice(minor, 'PLN', 'en').replace(/\s+/g, ' ')
    const subtotal = product.prices.EUR * 2
    const discount = 140
    const okReply = (sub: number, off: number) =>
      ({
        ok: true,
        code: 'ASF14',
        subtotalMinor: sub,
        discountMinor: off,
        totalMinor: sub - off
      }) as const

    const applyCode = async (code = 'asf14') => {
      fireEvent.click(screen.getByRole('button', {name: 'promo.toggle'}))
      fireEvent.change(screen.getByLabelText('promo.label'), {target: {value: code}})
      fireEvent.click(screen.getByRole('button', {name: 'promo.apply'}))
      await waitFor(() => {
        expect(validatePromoMock).toHaveBeenCalled()
      })
    }
    const fillValid = () => {
      type('nick.label', 'Steve_42')
      type('email.label', 'steve@example.com')
      fireEvent.click(screen.getByRole('checkbox', {name: /delivery/}))
      fireEvent.click(screen.getByRole('checkbox', {name: /terms/}))
    }
    const liveTotal = () =>
      within(screen.getByRole('complementary', {name: 'summary'})).getByRole('status')
    // The discount row leaves through an exit animation.
    const noDiscountRow = () =>
      waitFor(() => {
        expect(screen.queryByText('promo.discount')).toBeNull()
      })
    const payButtons = () => screen.getAllByRole('button', {name: /^pay/})

    it('applies a code: chip, discount row, total = subtotal − discount, and sends it with the order', async () => {
      validatePromoMock.mockResolvedValue(okReply(subtotal, discount))
      createOrderMock.mockReturnValue(new Promise(() => undefined))
      setup()
      fireEvent.click(screen.getByRole('button', {name: 'fill-cart'}))
      await applyCode()
      expect(validatePromoMock).toHaveBeenCalledWith({
        code: 'asf14',
        currency: 'EUR',
        lines: [{server: product.server, slug: product.slug, quantity: 2}]
      })
      expect(await screen.findByRole('button', {name: /^promo\.remove/})).toBeInTheDocument()
      expect(screen.getByText('ASF14')).toBeInTheDocument()
      const summary = screen.getByRole('complementary', {name: 'summary'})
      expect(summary).toHaveTextContent('promo.discount')
      expect(summary).toHaveTextContent(`−${eur(discount)}`)
      expect(liveTotal()).toHaveTextContent(eur(subtotal - discount))
      for (const button of payButtons())
        // An aria-label is not whitespace-normalized, so it keeps the formatter's no-break space.
        expect(button).toHaveAccessibleName(`pay ${formatPrice(subtotal - discount, 'EUR', 'en')}`)

      fillValid()
      await waitFor(() => {
        expect(payButtons()[0]).toBeEnabled()
      })
      fireEvent.click(payButtons()[0] as HTMLElement)
      await waitFor(() => {
        expect(createOrderMock).toHaveBeenCalledWith(expect.objectContaining({promoCode: 'ASF14'}))
      })
    })

    it('shows the reason for a code that does not apply and sends no code', async () => {
      validatePromoMock.mockResolvedValue({ok: false, reason: 'not_found'})
      setup()
      fireEvent.click(screen.getByRole('button', {name: 'fill-cart'}))
      await applyCode(' ASF-14 ')
      expect(await screen.findByRole('alert')).toHaveTextContent('promo.reasons.not_found')
      expect(screen.queryByRole('button', {name: /^promo\.remove/})).toBeNull()
      expect(liveTotal()).toHaveTextContent(eur(subtotal))
    })

    it('shows a rate limit as its own reason', async () => {
      validatePromoMock.mockResolvedValue({ok: false, reason: 'rate_limited'})
      setup()
      fireEvent.click(screen.getByRole('button', {name: 'fill-cart'}))
      await applyCode()
      expect(await screen.findByRole('alert')).toHaveTextContent('promo.reasons.rate_limited')
    })

    it('removes the code with the chip', async () => {
      validatePromoMock.mockResolvedValue(okReply(subtotal, discount))
      setup()
      fireEvent.click(screen.getByRole('button', {name: 'fill-cart'}))
      await applyCode()
      fireEvent.click(await screen.findByRole('button', {name: /^promo\.remove/}))
      await noDiscountRow()
      expect(liveTotal()).toHaveTextContent(eur(subtotal))
    })

    it('re-validates when the cart changes and keeps a code that still applies', async () => {
      validatePromoMock.mockResolvedValue(okReply(subtotal, discount))
      setup()
      fireEvent.click(screen.getByRole('button', {name: 'fill-cart'}))
      await applyCode()
      await screen.findByRole('button', {name: /^promo\.remove/})
      validatePromoMock.mockResolvedValue(okReply(product.prices.EUR * 3, 210))
      fireEvent.click(screen.getByRole('button', {name: 'add-one'}))
      await waitFor(() => {
        expect(validatePromoMock).toHaveBeenLastCalledWith(
          expect.objectContaining({
            lines: [{server: product.server, slug: product.slug, quantity: 3}]
          })
        )
      })
      await waitFor(() => {
        expect(liveTotal()).toHaveTextContent(eur(product.prices.EUR * 3 - 210))
      })
      expect(screen.getByRole('button', {name: /^promo\.remove/})).toBeInTheDocument()
    })

    it('turns quick cart changes into one re-check', async () => {
      validatePromoMock.mockResolvedValue(okReply(subtotal, discount))
      setup()
      fireEvent.click(screen.getByRole('button', {name: 'fill-cart'}))
      await applyCode()
      await screen.findByRole('button', {name: /^promo\.remove/})
      validatePromoMock.mockClear()
      jest.useFakeTimers()
      try {
        for (let i = 0; i < 4; i++) fireEvent.click(screen.getByRole('button', {name: 'add-one'}))
        act(() => {
          jest.advanceTimersByTime(299)
        })
        expect(validatePromoMock).not.toHaveBeenCalled()
        act(() => {
          jest.advanceTimersByTime(1)
        })
        expect(validatePromoMock).toHaveBeenCalledTimes(1)
        expect(validatePromoMock).toHaveBeenCalledWith(
          expect.objectContaining({
            lines: [{server: product.server, slug: product.slug, quantity: 6}]
          })
        )
      } finally {
        jest.useRealTimers()
      }
    })

    it('drops the code when the cart no longer qualifies', async () => {
      validatePromoMock.mockResolvedValue(okReply(subtotal, discount))
      createOrderMock.mockReturnValue(new Promise(() => undefined))
      setup()
      fireEvent.click(screen.getByRole('button', {name: 'fill-cart'}))
      await applyCode()
      await screen.findByRole('button', {name: /^promo\.remove/})
      validatePromoMock.mockResolvedValue({ok: false, reason: 'not_applicable'})
      fireEvent.click(screen.getByRole('button', {name: 'add-one'}))
      expect(await screen.findByRole('alert')).toHaveTextContent('promo.reasons.not_applicable')
      expect(screen.queryByRole('button', {name: /^promo\.remove/})).toBeNull()
      await noDiscountRow()
      expect(liveTotal()).toHaveTextContent(eur(product.prices.EUR * 3))

      fillValid()
      await waitFor(() => {
        expect(payButtons()[0]).toBeEnabled()
      })
      fireEvent.click(payButtons()[0] as HTMLElement)
      await waitFor(() => {
        expect(createOrderMock).toHaveBeenCalled()
      })
      expect(createOrderMock.mock.calls[0]?.[0]).not.toHaveProperty('promoCode')
    })

    it('drops a fixed code on currency switch', async () => {
      validatePromoMock.mockResolvedValue(okReply(subtotal, discount))
      setup()
      fireEvent.click(screen.getByRole('button', {name: 'fill-cart'}))
      await applyCode()
      await screen.findByRole('button', {name: /^promo\.remove/})
      validatePromoMock.mockResolvedValue({ok: false, reason: 'wrong_currency'})
      fireEvent.click(screen.getByRole('button', {name: 'switch-currency'}))
      await waitFor(() => {
        expect(validatePromoMock).toHaveBeenLastCalledWith(
          expect.objectContaining({currency: 'PLN'})
        )
      })
      expect(await screen.findByRole('alert')).toHaveTextContent('promo.reasons.wrong_currency')
      expect(screen.queryByRole('button', {name: /^promo\.remove/})).toBeNull()
      expect(liveTotal()).toHaveTextContent(pln(product.prices.PLN * 2))
    })

    it('clears the code and shows the reason when it fails at order time', async () => {
      validatePromoMock.mockResolvedValue(okReply(subtotal, discount))
      createOrderMock.mockResolvedValue({ok: false, error: 'promo', reason: 'used_up'})
      setup()
      fireEvent.click(screen.getByRole('button', {name: 'fill-cart'}))
      await applyCode()
      await screen.findByRole('button', {name: /^promo\.remove/})
      fillValid()
      await waitFor(() => {
        expect(payButtons()[0]).toBeEnabled()
      })
      fireEvent.click(payButtons()[0] as HTMLElement)
      expect(await screen.findByRole('alert')).toHaveTextContent('promo.reasons.used_up')
      expect(screen.queryByText(/errors\./)).toBeNull()
      expect(screen.queryByRole('button', {name: /^promo\.remove/})).toBeNull()
      expect(liveTotal()).toHaveTextContent(eur(subtotal))
      expect(mockReset).toHaveBeenCalled()
    })
  })
})
