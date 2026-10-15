import {renderWithStore} from '@/test/render-with-store'
import {fireEvent, screen, waitFor} from '@testing-library/react'

import {ProductEditor} from './product-editor'

jest.mock('next/navigation', () => ({useRouter: () => ({replace: jest.fn(), push: jest.fn()})}))

const servers = [
  {
    id: 's1',
    slug: 'survival',
    name: 'Survival',
    accent: '#ff6b1a',
    onAccent: '#000000',
    isActive: true,
    sort: 0,
    version: 1,
    productCount: 1,
    categories: [{id: 'c1', slug: 'ranks', name: 'Ranks'}],
    rcon: null,
    rconPasswordSet: false
  }
]
const draft = {
  id: 'p1',
  version: 1,
  sort: 0,
  serverId: 's1',
  categoryId: 'c1',
  slug: 'probe',
  kind: 'PERMANENT',
  durationDays: null,
  mark: 'PRB',
  icon: 'crown',
  isActive: false,
  grantCommands: [],
  revokeCommands: [],
  prices: {EUR: 499, PLN: null},
  translations: {en: {name: 'Probe', description: '', sections: []}, pl: null},
  missing: ['price.PLN', 'translation.pl']
}

function mockApi(patch: (body: unknown) => Response = () => Response.json(draft)) {
  return jest.spyOn(global, 'fetch').mockImplementation(async (input, init) => {
    const req = input instanceof Request ? input : new Request(String(input), init)
    const url = new URL(req.url)
    if (req.method === 'PATCH') return patch(await req.json())
    if (url.pathname === '/api/admin/catalog/servers') return Response.json(servers)
    if (url.pathname === '/api/admin/catalog/products/p1') return Response.json(draft)
    return Response.json([])
  })
}

describe('ProductEditor', () => {
  it('lists what is missing and keeps "Enabled" off until it is complete', async () => {
    mockApi()
    renderWithStore(<ProductEditor id="p1" canEdit />)
    expect(
      await screen.findByText('Missing to enable: PLN price, Polish translation')
    ).toBeInTheDocument()
    expect(screen.getByLabelText('Enabled')).toBeDisabled()
    fireEvent.change(screen.getByLabelText('Price PLN'), {target: {value: '21.99'}})
    fireEvent.click(screen.getByRole('tab', {name: 'PL'}))
    fireEvent.change(screen.getByLabelText('Name (PL)'), {target: {value: 'Sonda'}})
    expect(await screen.findByLabelText('Enabled')).toBeEnabled()
  })

  it('refuses a command with another placeholder before saving', async () => {
    const fetchMock = mockApi()
    renderWithStore(<ProductEditor id="p1" canEdit />)
    fireEvent.change(await screen.findByLabelText('Grant commands'), {
      target: {value: 'give {player} 1'}
    })
    fireEvent.click(screen.getByRole('button', {name: 'Save'}))
    expect(await screen.findByText('Only the {nick} placeholder is allowed')).toBeInTheDocument()
    expect(fetchMock.mock.calls.some(([r]) => (r as Request).method === 'PATCH')).toBe(false)
  })

  it('sends minor units and the version, and keeps the form on a 409 stale', async () => {
    let sent: unknown
    mockApi(body => {
      sent = body
      return Response.json({statusCode: 409, message: 'stale'}, {status: 409})
    })
    renderWithStore(<ProductEditor id="p1" canEdit />)
    fireEvent.change(await screen.findByLabelText('Price EUR'), {target: {value: '5,49'}})
    fireEvent.click(screen.getByRole('button', {name: 'Save'}))
    expect(await screen.findByRole('alert')).toHaveTextContent('Someone else changed this')
    await waitFor(() => {
      expect(sent).toMatchObject({version: 1, prices: {EUR: 549, PLN: null}})
    })
    expect(screen.getByLabelText('Price EUR')).toHaveValue('5,49')
  })

  it('is read-only without catalog.write', async () => {
    mockApi()
    renderWithStore(<ProductEditor id="p1" canEdit={false} />)
    expect(await screen.findByLabelText('Price EUR')).toBeDisabled()
    expect(screen.queryByRole('button', {name: 'Save'})).not.toBeInTheDocument()
  })
})
