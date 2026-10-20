import {CatalogProvider} from '@/features/catalog/catalog-provider'
import {TEST_CATALOG, renderWithCatalog} from '@/features/catalog/test-catalog'
import {fireEvent, screen} from '@testing-library/react'

import type {CatalogProduct} from '@shop/shared/catalog'

import {ProductCard} from './product-card'

jest.mock('next-intl', () => ({
  useLocale: () => 'pl',
  useTranslations: () => (key: string) => key
}))
jest.mock('@/features/cart/shop-provider', () => ({
  useCurrency: () => ({currency: 'PLN'}),
  useCartActions: () => ({add: jest.fn()})
}))

const product = TEST_CATALOG.products[0] as CatalogProduct

describe('ProductCard footer', () => {
  it('shows the full currency code and a labeled add button', () => {
    renderWithCatalog(<ProductCard product={product} onOpen={jest.fn()} />)
    expect(screen.getByText(/PLN|zł/)).toBeInTheDocument()
    expect(screen.getByRole('button', {name: 'add'})).toHaveTextContent('addShort')
  })

  it('stacks price above the button so a long price cannot push it out', () => {
    renderWithCatalog(<ProductCard product={product} onOpen={jest.fn()} />)
    const price = screen.getByText(/PLN|zł/)
    expect(price).toHaveClass('whitespace-nowrap')
    expect(price.parentElement).toHaveClass('flex-col')
    expect(price.parentElement).toContainElement(screen.getByRole('button', {name: 'add'}))
  })
})

describe('ProductCard on a server without RCON', () => {
  it('shows the product but a disabled unavailable button', () => {
    const [first, ...rest] = TEST_CATALOG.servers
    if (!first) throw new Error('no server')
    renderWithCatalog(<ProductCard product={product} onOpen={jest.fn()} />, {
      servers: [{...first, purchasable: false}, ...rest],
      products: TEST_CATALOG.products
    })
    expect(screen.getByRole('button', {name: product.name})).toBeInTheDocument()
    expect(screen.queryByRole('button', {name: 'add'})).not.toBeInTheDocument()
    expect(screen.getByRole('button', {name: 'unavailableProduct'})).toBeDisabled()
  })
})

describe('ProductCard opening', () => {
  it('clicking the title opens the modal', () => {
    const onOpen = jest.fn()
    renderWithCatalog(<ProductCard product={product} onOpen={onOpen} />)
    fireEvent.click(screen.getByRole('button', {name: product.name}))
    expect(onOpen).toHaveBeenCalledWith(product)
  })

  it('has no link to a product page', () => {
    renderWithCatalog(<ProductCard product={product} onOpen={jest.fn()} />)
    expect(screen.queryByRole('link')).not.toBeInTheDocument()
  })
})

// The card's background layer is the box that morphs into the product modal and back.
describe('ProductCard morph surface', () => {
  it('wears the surface while its modal is closed', () => {
    renderWithCatalog(<ProductCard product={product} onOpen={jest.fn()} />)
    expect(screen.getByTestId('product-card-surface')).toBeInTheDocument()
  })

  it('gives the surface to the modal while open, but keeps its content so the grid does not reflow', () => {
    renderWithCatalog(<ProductCard product={product} open onOpen={jest.fn()} />)
    expect(screen.queryByTestId('product-card-surface')).not.toBeInTheDocument()
    expect(screen.getByRole('button', {name: product.name})).toBeInTheDocument()
    expect(screen.getByRole('button', {name: 'add'})).toBeInTheDocument()
  })

  it('takes the surface back when the modal closes', () => {
    const {rerender} = renderWithCatalog(<ProductCard product={product} open onOpen={jest.fn()} />)
    rerender(
      <CatalogProvider servers={TEST_CATALOG.servers}>
        <ProductCard product={product} onOpen={jest.fn()} />
      </CatalogProvider>
    )
    expect(screen.getByTestId('product-card-surface')).toBeInTheDocument()
  })

  it('shows its plate normally while closed', () => {
    renderWithCatalog(<ProductCard product={product} onOpen={jest.fn()} />)
    expect(screen.getByTestId('product-plate').closest('.invisible')).toBeNull()
  })

  // The plate travels to the modal as its own shared element; an invisible copy holds the slot meanwhile.
  it('keeps an invisible plate in its slot while open', () => {
    renderWithCatalog(<ProductCard product={product} open onOpen={jest.fn()} />)
    expect(screen.getByTestId('product-plate').closest('.invisible')).not.toBeNull()
  })
})
