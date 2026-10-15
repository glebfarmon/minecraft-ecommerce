import {renderWithStore} from '@/test/render-with-store'
import {fireEvent, screen, within} from '@testing-library/react'

import {CatalogBoard} from './catalog-board'

const server = (
  id: string,
  name: string,
  categories: {id: string; slug: string; name: string}[]
) => ({
  id,
  slug: name.toLowerCase(),
  name,
  accent: '#ff6b1a',
  onAccent: '#000000',
  isActive: true,
  sort: 0,
  version: 1,
  productCount: 2,
  categories,
  rcon: null,
  rconPasswordSet: false
})
const ranks = {id: 'c-ranks', slug: 'ranks', name: 'Ranks'}
const kits = {id: 'c-kits', slug: 'kits', name: 'Kits'}
const product = (id: string, name: string, extra: object = {}) => ({
  id,
  version: 1,
  sort: 0,
  serverId: 's1',
  categoryId: 'c-ranks',
  slug: id,
  kind: 'PERMANENT',
  mark: name,
  icon: 'crown',
  name,
  isActive: true,
  prices: {EUR: 499, PLN: 2199},
  missing: [],
  ...extra
})

function mockApi(
  onWrite: (url: URL, init: RequestInit | undefined) => Response = () => Response.json({})
) {
  return jest.spyOn(global, 'fetch').mockImplementation((input, init) => {
    const req = input instanceof Request ? input : new Request(String(input), init)
    const url = new URL(req.url)
    if (req.method !== 'GET') return Promise.resolve(onWrite(url, init))
    if (url.pathname === '/api/admin/catalog/servers')
      return Promise.resolve(
        Response.json([server('s1', 'Survival', [ranks, kits]), server('s2', 'Anarchy', [])])
      )
    if (url.pathname === '/api/admin/catalog/categories') return Promise.resolve(Response.json([]))
    return Promise.resolve(
      Response.json([
        product('p1', 'VIP'),
        product('p2', 'Elite', {
          isActive: false,
          missing: ['price.PLN'],
          prices: {EUR: 999, PLN: null}
        })
      ])
    )
  })
}

describe('CatalogBoard', () => {
  it('shows server tabs, the first server’s categories and its products with badges', async () => {
    mockApi()
    renderWithStore(<CatalogBoard canEdit />)
    expect(await screen.findByRole('list', {name: 'Servers'})).toHaveTextContent('Survival')
    const ranksList = await screen.findByRole('list', {name: 'Products in Ranks'})
    expect(within(ranksList).getByText('VIP')).toBeInTheDocument()
    expect(within(ranksList).getByText('4.99 €')).toBeInTheDocument()
    const elite = within(ranksList).getByText('Elite').closest('li') as HTMLElement
    expect(elite).toHaveTextContent('Disabled')
    expect(elite).toHaveTextContent('Incomplete')
    expect(screen.getByRole('link', {name: '+ Product in Ranks'})).toHaveAttribute(
      'href',
      '/catalog/products/new?serverId=s1&categoryId=c-ranks'
    )
  })

  it('switches server', async () => {
    mockApi()
    renderWithStore(<CatalogBoard canEdit />)
    fireEvent.click(await screen.findByRole('tab', {name: 'Anarchy'}))
    expect(await screen.findByText('No categories yet. Attach one below.')).toBeInTheDocument()
  })

  it('explains why a category cannot be detached', async () => {
    mockApi(() =>
      Response.json({statusCode: 409, message: 'in_use', issues: {products: 2}}, {status: 409})
    )
    renderWithStore(<CatalogBoard canEdit />)
    fireEvent.click(await screen.findByRole('button', {name: 'Detach Ranks'}))
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'This is still in use: 2 products. Move or delete them first.'
    )
  })

  it('hides editing for read-only admins', async () => {
    mockApi()
    renderWithStore(<CatalogBoard canEdit={false} />)
    await screen.findByRole('list', {name: 'Servers'})
    expect(screen.queryByRole('link', {name: /^\+ /})).not.toBeInTheDocument()
    expect(screen.queryByRole('button', {name: /^Detach/})).not.toBeInTheDocument()
  })
})
