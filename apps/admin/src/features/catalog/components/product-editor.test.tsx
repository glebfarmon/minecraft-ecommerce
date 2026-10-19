import {renderWithStore} from '@/test/render-with-store'
import {markdownOf, setMarkdown} from '@/test/rich-field'
import {fireEvent, screen, waitFor, within} from '@testing-library/react'

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

  describe('an enabled product', () => {
    const enabled = {
      ...draft,
      isActive: true,
      prices: {EUR: 499, PLN: 2199},
      translations: {
        en: {name: 'Probe', description: '', sections: []},
        pl: {name: 'Sonda', description: '', sections: []}
      },
      missing: []
    }
    function mockEnabled() {
      const sent: unknown[] = []
      jest.spyOn(global, 'fetch').mockImplementation(async (input, init) => {
        const req = input instanceof Request ? input : new Request(String(input), init)
        const url = new URL(req.url)
        if (req.method === 'PATCH') {
          sent.push(await req.json())
          return Response.json({...enabled, version: 2})
        }
        if (url.pathname === '/api/admin/catalog/servers') return Response.json(servers)
        if (url.pathname === '/api/admin/catalog/products/p1') return Response.json(enabled)
        return Response.json([])
      })
      return sent
    }

    it('stays enabled when a price is cleared and typed again', async () => {
      const sent = mockEnabled()
      renderWithStore(<ProductEditor id="p1" canEdit />)
      const eur = await screen.findByLabelText('Price EUR')
      fireEvent.change(eur, {target: {value: ''}})
      expect(screen.getByLabelText('Enabled')).toBeChecked()
      expect(screen.getByLabelText('Enabled')).toBeEnabled()
      fireEvent.change(eur, {target: {value: '4.99'}})
      fireEvent.click(screen.getByRole('button', {name: 'Save'}))
      expect(
        await screen.findByText('Saved. Live on the site within a minute.')
      ).toBeInTheDocument()
      expect(sent).toEqual([expect.objectContaining({isActive: true})])
    })

    it('saves a formatted multi-line description as markdown', async () => {
      const sent = mockEnabled()
      renderWithStore(<ProductEditor id="p1" canEdit />)
      const description = await screen.findByLabelText('Description (EN)')
      expect(description).toHaveAttribute('aria-multiline', 'true')
      setMarkdown(description, '**Fast** delivery\nall ++day++')
      expect(markdownOf(description)).toBe('**Fast** delivery\nall ++day++')
      fireEvent.click(screen.getByRole('button', {name: 'Save'}))
      expect(
        await screen.findByText('Saved. Live on the site within a minute.')
      ).toBeInTheDocument()
      expect(sent).toEqual([
        expect.objectContaining({
          translations: expect.objectContaining({
            en: expect.objectContaining({description: '**Fast** delivery\nall ++day++'})
          })
        })
      ])
    })

    it('shows the stored formatting of a description when the product loads', async () => {
      const formatted = {
        ...enabled,
        translations: {
          ...enabled.translations,
          en: {...enabled.translations.en, description: '++Probe++ it'}
        }
      }
      jest.spyOn(global, 'fetch').mockImplementation(input => {
        const req = input instanceof Request ? input : new Request(String(input))
        const path = new URL(req.url).pathname
        if (path === '/api/admin/catalog/servers') return Promise.resolve(Response.json(servers))
        if (path === '/api/admin/catalog/products/p1')
          return Promise.resolve(Response.json(formatted))
        return Promise.resolve(Response.json([]))
      })
      renderWithStore(<ProductEditor id="p1" canEdit />)
      const description = await screen.findByLabelText('Description (EN)')
      await waitFor(() => {
        expect(description.querySelector('u')).toHaveTextContent('Probe')
      })
    })

    it('will not save while enabled and incomplete, and says how to fix it', async () => {
      const sent = mockEnabled()
      renderWithStore(<ProductEditor id="p1" canEdit />)
      await screen.findByLabelText('Price EUR')
      fireEvent.click(screen.getByRole('tab', {name: 'PL'}))
      fireEvent.change(screen.getByLabelText('Name (PL)'), {target: {value: ''}})
      fireEvent.click(screen.getByRole('button', {name: 'Save'}))
      expect(
        await screen.findByText('Fill Polish translation or untick Enabled')
      ).toBeInTheDocument()
      await new Promise(resolve => setTimeout(resolve, 50))
      expect(sent).toEqual([])
      expect(screen.getByLabelText('Enabled')).toBeChecked()
    })
  })

  it('updates the preview card as the name is typed', async () => {
    mockApi()
    renderWithStore(<ProductEditor id="p1" canEdit />)
    const name = await screen.findByLabelText('Name (EN)')
    fireEvent.change(name, {target: {value: 'Probe Deluxe'}})
    const preview = screen.getByRole('region', {name: 'Preview'})
    expect(await within(preview).findByText('Probe Deluxe')).toBeInTheDocument()
  })

  it('clicking {nick} inserts it at the caret of the grant field', async () => {
    mockApi()
    renderWithStore(<ProductEditor id="p1" canEdit />)
    const grant = await screen.findByLabelText<HTMLTextAreaElement>('Grant commands')
    fireEvent.change(grant, {target: {value: 'say hi '}})
    grant.setSelectionRange(7, 7)
    fireEvent.click(screen.getByRole('button', {name: 'Insert {nick}'}))
    expect(grant).toHaveValue('say hi {nick}')
  })

  it('inserts into revoke when revoke was focused last', async () => {
    mockApi()
    renderWithStore(<ProductEditor id="p1" canEdit />)
    const revoke = await screen.findByLabelText<HTMLTextAreaElement>('Revoke commands')
    fireEvent.change(revoke, {target: {value: 'lp user  parent remove vip'}})
    fireEvent.focus(revoke)
    revoke.setSelectionRange(8, 8)
    fireEvent.click(screen.getByRole('button', {name: 'Insert {nick}'}))
    expect(revoke).toHaveValue('lp user {nick} parent remove vip')
  })

  it('shows the example command', async () => {
    mockApi()
    renderWithStore(<ProductEditor id="p1" canEdit />)
    expect(await screen.findByText('give {nick} diamond 1')).toBeInTheDocument()
    expect(screen.getByText('The buyer’s nickname')).toBeInTheDocument()
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

  it('lets a read-only admin switch to the PL tab', async () => {
    mockApi()
    renderWithStore(<ProductEditor id="p1" canEdit={false} />)
    await screen.findByLabelText('Price EUR')
    // A browser does not click buttons inside a disabled fieldset; jsdom does, so check it directly.
    expect(screen.getByRole('tab', {name: 'PL'})).toBeEnabled()
    fireEvent.click(screen.getByRole('tab', {name: 'PL'}))
    expect(await screen.findByLabelText('Name (PL)')).toBeDisabled()
  })

  it('keeps the loaded version after a 409, even when the refetch brings a newer one', async () => {
    const versions: unknown[] = []
    let patched = false
    jest.spyOn(global, 'fetch').mockImplementation(async (input, init) => {
      const req = input instanceof Request ? input : new Request(String(input), init)
      const url = new URL(req.url)
      if (req.method === 'PATCH') {
        patched = true
        versions.push(((await req.json()) as {version: unknown}).version)
        return Response.json({statusCode: 409, message: 'stale'}, {status: 409})
      }
      if (url.pathname === '/api/admin/catalog/servers') return Response.json(servers)
      if (url.pathname === '/api/admin/catalog/products/p1')
        return Response.json(patched ? {...draft, version: 2} : draft)
      return Response.json([])
    })
    renderWithStore(<ProductEditor id="p1" canEdit />)
    await screen.findByLabelText('Price EUR')
    fireEvent.click(screen.getByRole('button', {name: 'Save'}))
    expect(await screen.findByRole('alert')).toHaveTextContent('Someone else changed this')
    // Give any refetch triggered by the failed save time to land.
    await new Promise(resolve => setTimeout(resolve, 50))
    fireEvent.click(screen.getByRole('button', {name: 'Save'}))
    await waitFor(() => {
      expect(versions).toEqual([1, 1])
    })
  })

  it('opens the tab that holds a translation error when Save is blocked', async () => {
    const fetchMock = mockApi()
    renderWithStore(<ProductEditor id="p1" canEdit />)
    await screen.findByLabelText('Price EUR')
    fireEvent.click(screen.getByRole('tab', {name: 'PL'}))
    fireEvent.change(screen.getByLabelText('Name (PL)'), {target: {value: 'x'.repeat(61)}})
    fireEvent.click(screen.getByRole('tab', {name: 'EN'}))
    expect(screen.queryByLabelText('Name (PL)')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', {name: 'Save'}))
    expect(await screen.findByText('Use at most 60 characters')).toBeInTheDocument()
    expect(screen.getByRole('tab', {name: 'PL'})).toHaveAttribute('aria-selected', 'true')
    expect(fetchMock.mock.calls.some(([r]) => (r as Request).method === 'PATCH')).toBe(false)
  })
})
