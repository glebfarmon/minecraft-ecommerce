import {ShopProvider, useShop} from '@/features/cart/shop-provider'
import type {Product} from '@/lib/catalog'
import {products} from '@/lib/catalog'
import {fireEvent, render, screen, waitFor} from '@testing-library/react'

import {CartMenu} from './cart-menu'

jest.mock('next-intl', () => ({
  useLocale: () => 'en',
  useTranslations: () => (key: string) => key
}))
// jsdom never finishes the shared-layout exit; unmount at once.
jest.mock('motion/react', () => ({
  ...jest.requireActual<object>('motion/react'),
  AnimatePresence: ({children}: {children: React.ReactNode}) => children
}))

const [first] = products
if (!first) throw new Error('catalog is empty')
const product: Product = first

function AddProduct() {
  const {add} = useShop()
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
})
