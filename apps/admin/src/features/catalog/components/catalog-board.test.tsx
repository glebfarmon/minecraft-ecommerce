import {renderWithStore} from '@/test/render-with-store'
import {fireEvent, screen, waitFor, within} from '@testing-library/react'

import {CatalogBoard} from './catalog-board'

// Dragging is dnd-kit's job (sortable-list); here a button stands in for a drop that reverses the list.
jest.mock('./sortable-list', () => {
  const {createElement, Fragment} = jest.requireActual<typeof import('react')>('react')
  const actual = jest.requireActual<typeof import('./sortable-list')>('./sortable-list')
  return {
    ...actual,
    SortableList: (props: Parameters<typeof actual.SortableList>[0]) =>
      createElement(
        Fragment,
        null,
        createElement(actual.SortableList, props),
        createElement(
          'button',
          {
            type: 'button',
            onClick: () => {
              props.onMove(
                [...props.items].reverse().map(i => i.id),
                0,
                props.items.length - 1
              )
            }
          },
          `Reverse ${props.label}`
        )
      )
  }
})

const server = (
  id: string,
  name: string,
  categories: {id: string; slug: string; name: string; icon: string}[]
) => ({
  id,
  slug: name.toLowerCase(),
  name,
  accent: '#ff6b1a',
  onAccent: '#0e0e10',
  isActive: true,
  sort: 0,
  version: 1,
  productCount: 2,
  categories,
  rcon: null,
  rconPasswordSet: false
})
const ranks = {id: 'c-ranks', slug: 'ranks', name: 'Ranks', icon: 'crown'}
const kits = {id: 'c-kits', slug: 'kits', name: 'Kits', icon: 'pickaxe'}
const tools = {id: 'c-tools', slug: 'tools', name: 'Tools', icon: 'crown'}
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
  onWrite: (url: URL, req: Request) => Response | Promise<Response> = () => Response.json({}),
  products?: () => Promise<Response>
) {
  return jest.spyOn(global, 'fetch').mockImplementation((input, init) => {
    const req = input instanceof Request ? input : new Request(String(input), init)
    const url = new URL(req.url)
    if (req.method !== 'GET') return Promise.resolve(onWrite(url, req))
    if (url.pathname === '/api/admin/catalog/servers')
      return Promise.resolve(
        Response.json([server('s1', 'Survival', [ranks, kits, tools]), server('s2', 'Anarchy', [])])
      )
    if (url.pathname === '/api/admin/catalog/categories')
      return Promise.resolve(
        Response.json([
          {
            id: 'c-extra',
            slug: 'extra',
            names: {en: 'Extra', pl: 'Ekstra'},
            version: 1,
            productCount: 0,
            servers: []
          }
        ])
      )
    if (products) return products()
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
    expect(within(ranksList).getByText(/€4\.99/)).toBeInTheDocument()
    const elite = within(ranksList).getByText('Elite').closest('li') as HTMLElement
    expect(elite).toHaveTextContent('Disabled')
    expect(elite).toHaveTextContent('Incomplete')
    expect(screen.getByRole('link', {name: '+ Product in Ranks'})).toHaveAttribute(
      'href',
      '/catalog/products/new?serverId=s1&categoryId=c-ranks'
    )
  })

  it('server cards use the server colours and say whether RCON is set', async () => {
    mockApi()
    renderWithStore(<CatalogBoard canEdit />)
    const tab = await screen.findByRole('tab', {name: /Anarchy/})
    expect(tab).toHaveStyle({color: 'rgb(14, 14, 16)'}) // onAccent from the fixture
    expect(within(tab).getByText(/RCON (ready|not set)/)).toBeInTheDocument()
  })

  it('product cards link by name and keep the add link per category', async () => {
    mockApi()
    renderWithStore(<CatalogBoard canEdit />)
    const list = await screen.findByRole('list', {name: 'Products in Ranks'})
    expect(
      within(list)
        .getAllByRole('link')
        .map(l => l.textContent)
    ).toEqual(['VIP', 'Elite'])
    expect(screen.getByRole('link', {name: '+ Product in Ranks'})).toBeInTheDocument()
  })

  it('switches server', async () => {
    mockApi()
    renderWithStore(<CatalogBoard canEdit />)
    fireEvent.click(await screen.findByRole('tab', {name: /Anarchy/}))
    expect(await screen.findByText('No categories on Anarchy yet.')).toBeInTheDocument()
  })

  it('a server with no categories shows the attach form and a Create category link in the empty state', async () => {
    mockApi()
    renderWithStore(<CatalogBoard canEdit />)
    fireEvent.click(await screen.findByRole('tab', {name: /Anarchy/}))
    const empty = (await screen.findByText('No categories on Anarchy yet.'))
      .parentElement as HTMLElement
    expect(within(empty).getByLabelText('Attach category')).toBeInTheDocument()
    expect(within(empty).getByRole('link', {name: 'Create category'})).toHaveAttribute(
      'href',
      '/catalog/categories'
    )
  })

  it('clicking the server plate selects it and does not navigate', async () => {
    mockApi()
    renderWithStore(<CatalogBoard canEdit />)
    const tab = await screen.findByRole('tab', {name: /Anarchy/})
    expect(tab.closest('a')).toBeNull()
    fireEvent.click(tab)
    expect(tab).toHaveAttribute('aria-selected', 'true')
  })

  it('the pencil links to the server editor', async () => {
    mockApi()
    renderWithStore(<CatalogBoard canEdit />)
    expect(await screen.findByRole('link', {name: 'Edit Survival'})).toHaveAttribute(
      'href',
      '/catalog/servers/s1'
    )
  })

  it('the category pencil links to its edit form', async () => {
    mockApi()
    renderWithStore(<CatalogBoard canEdit />)
    expect(await screen.findByRole('link', {name: 'Edit Ranks'})).toHaveAttribute(
      'href',
      '/catalog/categories?edit=c-ranks'
    )
  })

  it('product cards are links over the whole card, with the drag handle on top', async () => {
    mockApi()
    renderWithStore(<CatalogBoard canEdit />)
    const list = await screen.findByRole('list', {name: 'Products in Ranks'})
    expect(within(list).getByRole('link', {name: 'VIP'}).className).toMatch(/after:inset-0/)
    expect(within(list).getByRole('button', {name: 'Move VIP'}).className).toMatch(/z-10/)
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

  describe('sends the order each change was made from', () => {
    const writes: {path: string; body: unknown}[] = []
    const record = (pending = false) =>
      mockApi(async (url, req) => {
        writes.push({path: url.pathname, body: await req.json()})
        return pending ? new Promise<Response>(() => undefined) : Response.json({})
      })
    beforeEach(() => {
      writes.length = 0
    })

    it.each([
      ['Servers', '/api/admin/catalog/servers/order', {ids: ['s2', 's1'], base: ['s1', 's2']}],
      [
        'Categories of Survival',
        '/api/admin/catalog/servers/s1/categories',
        {categoryIds: ['c-tools', 'c-kits', 'c-ranks'], base: ['c-ranks', 'c-kits', 'c-tools']}
      ],
      [
        'Products in Ranks',
        '/api/admin/catalog/servers/s1/categories/c-ranks/products/order',
        {ids: ['p2', 'p1'], base: ['p1', 'p2']}
      ]
    ])('when reordering %s', async (label, path, body) => {
      record()
      renderWithStore(<CatalogBoard canEdit />)
      await screen.findByRole('list', {name: 'Products in Ranks'})
      fireEvent.click(screen.getByRole('button', {name: `Reverse ${label}`}))
      await waitFor(() => {
        expect(writes).toEqual([{path, body}])
      })
    })

    it('when detaching, from the list as shown', async () => {
      record(true)
      renderWithStore(<CatalogBoard canEdit />)
      await screen.findByRole('list', {name: 'Products in Ranks'})
      fireEvent.click(screen.getByRole('button', {name: 'Reverse Categories of Survival'}))
      fireEvent.click(screen.getByRole('button', {name: 'Detach Kits'}))
      await waitFor(() => {
        expect(writes).toHaveLength(2)
      })
      expect(writes[1]).toEqual({
        path: '/api/admin/catalog/servers/s1/categories',
        body: {categoryIds: ['c-tools', 'c-ranks'], base: ['c-ranks', 'c-kits', 'c-tools']}
      })
    })
  })

  it('says products are loading instead of claiming there are none', async () => {
    mockApi(undefined, () => new Promise<Response>(() => undefined))
    renderWithStore(<CatalogBoard canEdit />)
    expect((await screen.findAllByText('Loading products…')).length).toBeGreaterThan(0)
    expect(screen.queryByText('No products.')).not.toBeInTheDocument()
  })

  it('says when products could not be loaded', async () => {
    mockApi(undefined, () =>
      Promise.resolve(Response.json({statusCode: 500, message: 'oops'}, {status: 500}))
    )
    renderWithStore(<CatalogBoard canEdit />)
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Could not load products. Refresh the page.'
    )
    expect(screen.queryByText('No products.')).not.toBeInTheDocument()
  })

  it('hides editing for read-only admins', async () => {
    mockApi()
    renderWithStore(<CatalogBoard canEdit={false} />)
    await screen.findByRole('list', {name: 'Servers'})
    expect(screen.queryByRole('link', {name: /^\+ /})).not.toBeInTheDocument()
    expect(screen.queryByRole('button', {name: /^Detach/})).not.toBeInTheDocument()
    expect(screen.queryByRole('link', {name: /^Edit /})).not.toBeInTheDocument()
  })
})
