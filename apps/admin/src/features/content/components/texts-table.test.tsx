import {renderWithStore} from '@/test/render-with-store'
import {fireEvent, screen, waitFor, within} from '@testing-library/react'

import {TextsTable} from './texts-table'

type Msg = {key: string; namespace: string; default: string; override: string | null}

const LONG = 'L'.repeat(100)

function messages(): Msg[] {
  return [
    {key: 'hero.title', namespace: 'hero', default: 'Welcome', override: null},
    {
      key: 'rules.title',
      namespace: 'rules',
      default: 'Rules <accent>x</accent>',
      override: 'X <accent>y</accent>'
    },
    {key: 'hero.long', namespace: 'hero', default: LONG, override: null}
  ]
}

function mockApi(
  write: (method: string, url: string, body: unknown) => Response,
  list: () => Msg[] = messages
) {
  return jest.spyOn(global, 'fetch').mockImplementation(async (input, init) => {
    const req = input instanceof Request ? input : new Request(String(input), init)
    if (req.method !== 'GET') return write(req.method, req.url, await req.json().catch(() => null))
    return Response.json(list())
  })
}

describe('TextsTable', () => {
  it('saves one override and shows the placeholder error under that row only', async () => {
    const calls: string[] = []
    mockApi((method, url) => {
      calls.push(`${method} ${url}`)
      return Response.json(
        {
          statusCode: 422,
          message: 'placeholder_mismatch',
          issues: {expected: ['<accent>'], found: []}
        },
        {status: 422}
      )
    })
    renderWithStore(<TextsTable />)
    const rules = await screen.findByLabelText('Override for rules.title')
    expect(rules).toHaveValue('X <accent>y</accent>')
    fireEvent.change(rules, {target: {value: 'X plain'}})
    const row = rules.closest('tr') as HTMLElement
    fireEvent.click(within(row).getByRole('button', {name: 'Save'}))
    expect(await within(row).findByRole('alert')).toHaveTextContent('<accent>')
    expect(calls[0]).toMatch(/^PUT .*\/en\/rules\.title$/)
    const hero = screen.getByLabelText('Override for hero.title').closest('tr') as HTMLElement
    expect(within(hero).queryByRole('alert')).not.toBeInTheDocument()
    expect(screen.getAllByRole('alert')).toHaveLength(1)
  })

  it('groups rows under namespace headings and uses a textarea for long texts', async () => {
    mockApi(() => Response.json({}))
    renderWithStore(<TextsTable />)
    await screen.findByLabelText('Override for hero.title')
    expect(screen.getByRole('heading', {name: 'hero'})).toBeInTheDocument()
    expect(screen.getByRole('heading', {name: 'rules'})).toBeInTheDocument()
    expect(screen.getByLabelText('Override for hero.title').tagName).toBe('INPUT')
    expect(screen.getByLabelText('Override for hero.long').tagName).toBe('TEXTAREA')
  })

  it('filters by the search box across key and text', async () => {
    mockApi(() => Response.json({}))
    renderWithStore(<TextsTable />)
    await screen.findByLabelText('Override for hero.title')
    fireEvent.change(screen.getByLabelText('Search texts'), {target: {value: 'accent'}})
    expect(screen.getByLabelText('Override for rules.title')).toBeInTheDocument()
    expect(screen.queryByLabelText('Override for hero.title')).not.toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Search texts'), {target: {value: 'welcome'}})
    expect(screen.getByLabelText('Override for hero.title')).toBeInTheDocument()
    expect(screen.queryByLabelText('Override for rules.title')).not.toBeInTheDocument()
  })

  it('resets an override with DELETE and the badge disappears', async () => {
    let overridden = true
    const calls: string[] = []
    mockApi(
      (method, url) => {
        calls.push(`${method} ${url}`)
        overridden = false
        return new Response(null, {status: 204})
      },
      () =>
        messages().map(m => (m.key === 'rules.title' && !overridden ? {...m, override: null} : m))
    )
    renderWithStore(<TextsTable />)
    const input = await screen.findByLabelText('Override for rules.title')
    const row = input.closest('tr') as HTMLElement
    expect(within(row).getByText('changed')).toBeInTheDocument()
    expect(
      within(
        screen.getByLabelText('Override for hero.title').closest('tr') as HTMLElement
      ).queryByRole('button', {name: 'Reset'})
    ).not.toBeInTheDocument()
    fireEvent.click(within(row).getByRole('button', {name: 'Reset'}))
    await waitFor(() => {
      expect(within(row).queryByText('changed')).not.toBeInTheDocument()
    })
    expect(calls[0]).toMatch(/^DELETE .*\/en\/rules\.title$/)
    expect(screen.getByLabelText('Override for rules.title')).toHaveValue('')
  })

  it('loads the other locale from the PL tab', async () => {
    const urls: string[] = []
    jest.spyOn(global, 'fetch').mockImplementation(input => {
      urls.push(input instanceof Request ? input.url : String(input))
      return Promise.resolve(Response.json(messages()))
    })
    renderWithStore(<TextsTable />)
    await screen.findByLabelText('Override for hero.title')
    fireEvent.mouseDown(screen.getByRole('tab', {name: 'PL'}), {button: 0})
    await waitFor(() => {
      expect(urls.some(u => u.includes('locale=pl'))).toBe(true)
    })
  })

  it('shows the other locale texts after switching, and saves the PL value to the PL URL', async () => {
    const puts: {url: string; body: unknown}[] = []
    jest.spyOn(global, 'fetch').mockImplementation(async (input, init) => {
      const req = input instanceof Request ? input : new Request(String(input), init)
      if (req.method === 'PUT') {
        puts.push({url: req.url, body: await req.json()})
        return Response.json({})
      }
      const pl = new URL(req.url).searchParams.get('locale') === 'pl'
      return Response.json([
        {key: 'hero.title', namespace: 'hero', default: 'Welcome', override: pl ? 'Cześć' : 'Hello'}
      ])
    })
    renderWithStore(<TextsTable />)
    expect(await screen.findByLabelText('Override for hero.title')).toHaveValue('Hello')
    fireEvent.mouseDown(screen.getByRole('tab', {name: 'PL'}), {button: 0})
    await waitFor(() => {
      expect(screen.getByLabelText('Override for hero.title')).toHaveValue('Cześć')
    })
    fireEvent.change(screen.getByLabelText('Override for hero.title'), {
      target: {value: 'Cześć!'}
    })
    fireEvent.click(screen.getByRole('button', {name: 'Save'}))
    await waitFor(() => {
      expect(puts).toHaveLength(1)
    })
    expect(puts[0]?.url).toMatch(/\/pl\/hero\.title$/)
    expect(puts[0]?.body).toEqual({value: 'Cześć!'})
  })

  it('puts the search box before the first table', async () => {
    mockApi(() => Response.json({}))
    renderWithStore(<TextsTable />)
    const search = screen.getByLabelText('Search texts')
    const table = (await screen.findAllByRole('table'))[0] as HTMLElement
    expect(search.compareDocumentPosition(table) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })
})
