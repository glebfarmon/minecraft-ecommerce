import type {Product} from '@/config/products'
import {products} from '@/config/products'
import {ShopProvider, useCartActions} from '@/features/cart/shop-provider'
import {fireEvent, render, screen, waitFor} from '@testing-library/react'
import {MotionGlobalConfig} from 'motion/react'

import {CartMenu} from './cart-menu'

// Checkout keys carry their namespace so they never collide with the cart's own ("title", "checkout").
jest.mock('next-intl', () => ({
  useLocale: () => 'en',
  useTranslations: (namespace?: string) => {
    const name = (key: string) => (namespace === 'checkout' ? `checkout.${key}` : key)
    return Object.assign((key: string) => name(key), {rich: (key: string) => name(key)})
  }
}))
// jsdom never finishes the shared-layout exit; unmount at once.
jest.mock('motion/react', () => ({
  ...jest.requireActual<object>('motion/react'),
  AnimatePresence: ({children}: {children: React.ReactNode}) => children
}))

beforeAll(() => {
  MotionGlobalConfig.skipAnimations = true
})
afterAll(() => {
  MotionGlobalConfig.skipAnimations = false
})

const [first] = products
if (!first) throw new Error('catalog is empty')
const product: Product = first

function AddProduct() {
  const {add} = useCartActions()
  return (
    <button
      type="button"
      onClick={() => {
        add(product)
      }}>
      add-product
    </button>
  )
}

const setup = () =>
  render(
    <ShopProvider>
      <AddProduct />
      <CartMenu />
    </ShopProvider>
  )
const open = () => {
  fireEvent.click(screen.getByRole('button', {name: 'label'}))
}

describe('CartMenu', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('shows the empty state and a disabled checkout', () => {
    setup()
    open()
    expect(screen.getByText('empty')).toBeInTheDocument()
    expect(screen.getByRole('button', {name: 'checkout'})).toBeDisabled()
  })

  it('has no badge while the cart is empty', () => {
    setup()
    expect(screen.getByRole('button', {name: 'label'})).not.toHaveTextContent(/\d/)
  })

  it('shows the item count badge on the trigger', () => {
    setup()
    fireEvent.click(screen.getByText('add-product'))
    expect(screen.getByRole('button', {name: 'label'})).toHaveTextContent('1')
  })

  it('lists the added product and removes it', async () => {
    setup()
    fireEvent.click(screen.getByText('add-product'))
    open()
    expect(screen.getByText(product.name)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', {name: 'remove'}))
    await waitFor(() => {
      expect(screen.getByText('empty')).toBeInTheDocument()
    })
  })

  it('shows no quantity stepper for a single item', () => {
    setup()
    fireEvent.click(screen.getByText('add-product'))
    open()
    expect(screen.queryByRole('button', {name: 'increase'})).not.toBeInTheDocument()
    expect(screen.queryByRole('button', {name: 'decrease'})).not.toBeInTheDocument()
  })

  it('shows a stepper once the quantity is above 1 and changes it', async () => {
    setup()
    fireEvent.click(screen.getByText('add-product'))
    fireEvent.click(screen.getByText('add-product'))
    open()
    expect(screen.getByTestId('cart-qty')).toHaveTextContent('2')
    fireEvent.click(screen.getByRole('button', {name: 'increase'}))
    await waitFor(() => {
      expect(screen.getByTestId('cart-qty')).toHaveTextContent('3')
    })
    fireEvent.click(screen.getByRole('button', {name: 'decrease'}))
    fireEvent.click(screen.getByRole('button', {name: 'decrease'}))
    // Back at 1: the stepper is gone, removing stays on the X button.
    expect(screen.queryByTestId('cart-qty')).not.toBeInTheDocument()
    expect(screen.getByRole('button', {name: 'remove'})).toBeInTheDocument()
  })

  it('stops at 99: the plus button is disabled and further adds change nothing', async () => {
    setup()
    for (let i = 0; i < 100; i++) fireEvent.click(screen.getByText('add-product'))
    open()
    await waitFor(() => {
      expect(screen.getByTestId('cart-qty')).toHaveTextContent('99')
    })
    expect(screen.getByRole('button', {name: 'increase'})).toBeDisabled()
    fireEvent.click(screen.getByRole('button', {name: 'decrease'}))
    await waitFor(() => {
      expect(screen.getByTestId('cart-qty')).toHaveTextContent('98')
    })
    expect(screen.getByRole('button', {name: 'increase'})).toBeEnabled()
  })

  describe('checkout', () => {
    const cartPanel = () => screen.getByRole('dialog', {name: 'title'})
    const checkoutDialog = () => screen.getByRole('dialog', {name: 'checkout.title'})
    const goToCheckout = () => {
      fireEvent.click(screen.getByText('add-product'))
      open()
      fireEvent.click(screen.getByRole('button', {name: 'checkout'}))
    }

    it('enables the checkout button once there is something to buy', () => {
      setup()
      fireEvent.click(screen.getByText('add-product'))
      open()
      expect(screen.getByRole('button', {name: 'checkout'})).toBeEnabled()
    })

    it('swaps the cart panel for the checkout modal', async () => {
      setup()
      goToCheckout()
      expect(checkoutDialog()).toBeInTheDocument()
      await waitFor(() => {
        expect(screen.queryByRole('dialog', {name: 'title'})).toBeNull()
      })
    })

    it('goes back from checkout to the cart panel', async () => {
      setup()
      goToCheckout()
      fireEvent.click(screen.getByRole('button', {name: 'checkout.back'}))
      await waitFor(() => {
        expect(screen.queryByRole('dialog', {name: 'checkout.title'})).toBeNull()
      })
      expect(cartPanel()).toBeInTheDocument()
    })

    it('closes everything from the checkout X button and gives the cart trigger back', async () => {
      setup()
      goToCheckout()
      fireEvent.click(screen.getByRole('button', {name: 'checkout.close'}))
      await waitFor(() => {
        expect(screen.queryByRole('dialog')).toBeNull()
      })
      expect(screen.getByRole('button', {name: 'label'})).toBeInTheDocument()
    })

    it('does not treat a click inside the checkout modal as an outside click on the cart', () => {
      setup()
      goToCheckout()
      fireEvent.pointerDown(screen.getByLabelText('checkout.nick.label'))
      expect(checkoutDialog()).toBeInTheDocument()
    })
  })
})
