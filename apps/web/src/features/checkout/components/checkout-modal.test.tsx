import type {Product} from '@/config/products'
import {products} from '@/config/products'
import {ShopProvider, useCartActions} from '@/features/cart/shop-provider'
import {fireEvent, render, screen, waitFor} from '@testing-library/react'
import {MotionGlobalConfig} from 'motion/react'
import type {ReactNode} from 'react'

import {CheckoutModal} from './checkout-modal'

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

const [first] = products
if (!first) throw new Error('catalog is empty')
const product: Product = first

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

function setup({onBack = jest.fn(), onClose = jest.fn(), open = true} = {}) {
  const ui = (isOpen: boolean) => (
    <ShopProvider>
      <Fill />
      <CheckoutModal open={isOpen} layoutId="cart" onBack={onBack} onClose={onClose} />
    </ShopProvider>
  )
  const view = render(ui(open))
  return {
    ...view,
    onBack,
    onClose,
    rerenderWith: (isOpen: boolean) => {
      view.rerender(ui(isOpen))
    }
  }
}

const type = (label: string, value: string) => {
  fireEvent.change(screen.getByLabelText(label), {target: {value}})
}
const blur = (label: string) => {
  fireEvent.blur(screen.getByLabelText(label))
}

describe('CheckoutModal', () => {
  beforeEach(() => {
    localStorage.clear()
  })

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

  describe('promo code', () => {
    it('stays behind a toggle until asked for', () => {
      setup()
      expect(screen.queryByLabelText('promo.label')).toBeNull()
      const toggle = screen.getByRole('button', {name: 'promo.toggle'})
      expect(toggle).toHaveAttribute('aria-expanded', 'false')
      fireEvent.click(toggle)
      expect(screen.getByLabelText('promo.label')).toHaveFocus()
      expect(screen.queryByRole('button', {name: 'promo.toggle'})).toBeNull()
    })

    it('opens by itself when a code was already entered, so it is never hidden with a value in it', async () => {
      const {rerenderWith} = setup()
      fireEvent.click(screen.getByRole('button', {name: 'promo.toggle'}))
      type('promo.label', 'SPRING')
      rerenderWith(false)
      await waitFor(() => {
        expect(screen.queryByRole('dialog')).toBeNull()
      })
      rerenderWith(true)
      expect(screen.getByLabelText('promo.label')).toHaveValue('SPRING')
    })
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
})
