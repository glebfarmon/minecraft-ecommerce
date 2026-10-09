import {products} from '@/config/products'
import {ShopProvider} from '@/features/cart/shop-provider'
import {fireEvent, render, screen, waitFor} from '@testing-library/react'
import {MotionGlobalConfig} from 'motion/react'
import {Children, useEffect, useRef} from 'react'
import type {ReactNode} from 'react'

import {Catalog} from './catalog'

const flyToCart = jest.fn()
// What the page looked like when the flight started: the modal must already be gone.
let dialogOpenAtFlight: boolean | undefined
jest.mock('@/lib/fly-to-cart', () => ({
  flyToCart: (el: unknown) => {
    dialogOpenAtFlight = document.querySelector('dialog') !== null
    flyToCart(el)
  }
}))
jest.mock('next-intl', () => ({
  useLocale: () => 'en',
  useTranslations: () => (key: string) => key
}))
// jsdom never finishes a shared-layout exit, so the modal would stay mounted. This stand-in unmounts at once and
// reports `onExitComplete` the moment the children are gone; the real exit is covered in the browser.
jest.mock('motion/react', () => ({
  ...jest.requireActual<object>('motion/react'),
  AnimatePresence: ({
    children,
    onExitComplete
  }: {
    children: ReactNode
    onExitComplete?: () => void
  }) => {
    const present = Children.toArray(children).length > 0
    const was = useRef(present)
    useEffect(() => {
      if (was.current && !present) onExitComplete?.()
      was.current = present
    })
    return children
  }
}))
jest.mock('@/i18n/navigation', () => ({getPathname: ({href}: {href: string}) => href}))

beforeAll(() => {
  MotionGlobalConfig.skipAnimations = true
})
afterAll(() => {
  MotionGlobalConfig.skipAnimations = false
})
beforeEach(() => {
  localStorage.clear()
  flyToCart.mockClear()
  dialogOpenAtFlight = undefined
})

const product = products.find(p => p.server === 'survival')
if (!product) throw new Error('catalog is empty')

const openModal = () => {
  fireEvent.click(screen.getByRole('button', {name: product.name}))
}
const addFromModal = () => {
  fireEvent.click(screen.getByRole('button', {name: 'addToCart'}))
}

describe('Catalog: add to cart from the product modal', () => {
  it('flies the card into the cart only after the modal has closed back into it', async () => {
    render(
      <ShopProvider>
        <Catalog initialServer="survival" />
      </ShopProvider>
    )
    openModal()
    addFromModal()
    await waitFor(() => {
      expect(flyToCart).toHaveBeenCalledTimes(1)
    })
    expect(dialogOpenAtFlight).toBe(false)
    const [source] = flyToCart.mock.calls[0] as [HTMLElement]
    expect(source.tagName).toBe('ARTICLE')
    expect(source).toHaveTextContent(product.name)
  })

  it('does not fly when the modal is just closed', async () => {
    render(
      <ShopProvider>
        <Catalog initialServer="survival" />
      </ShopProvider>
    )
    openModal()
    fireEvent.click(screen.getByRole('button', {name: 'close'}))
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })
    expect(flyToCart).not.toHaveBeenCalled()
  })
})
