import {renderWithStore} from '@/test/render-with-store'
import {findToast} from '@/test/toast'
import {fireEvent, screen, waitFor, within} from '@testing-library/react'

import {ServerEditor} from './server-editor'

jest.mock('next/navigation', () => ({useRouter: () => ({replace: jest.fn(), push: jest.fn()})}))

const survival = {
  id: 's1',
  slug: 'survival',
  name: 'Survival',
  accent: '#ff6b1a',
  onAccent: '#000000',
  isActive: true,
  sort: 0,
  version: 4,
  productCount: 6,
  categories: [],
  rcon: {host: 'mc.example.com', port: 25575},
  rconPasswordSet: true
}

function mockApi(
  write: (method: string, body: unknown) => Response = () => Response.json(survival)
) {
  return jest.spyOn(global, 'fetch').mockImplementation(async (input, init) => {
    const req = input instanceof Request ? input : new Request(String(input), init)
    if (req.method !== 'GET') return write(req.method, await req.json().catch(() => null))
    return Response.json(survival)
  })
}

describe('ServerEditor', () => {
  it('previews the server card in the chosen colors', async () => {
    mockApi()
    renderWithStore(<ServerEditor id="s1" canEdit canRcon={false} />)
    const region = await screen.findByRole('region', {name: 'Preview'})
    const preview = (await within(region).findByText('Survival')).parentElement as HTMLElement
    expect(preview).toHaveStyle({background: '#ff6b1a', color: '#000000'})
    fireEvent.change(screen.getByLabelText('Accent'), {target: {value: '#2266ff'}})
    expect(preview).toHaveStyle({background: '#2266ff'})
  })

  it('loads in its own layout: labels and sections stay, values are placeholders', () => {
    mockApi()
    renderWithStore(<ServerEditor canEdit canRcon skeleton />)
    expect(screen.getByRole('status')).toHaveTextContent('Loading…')
    expect(screen.getByText('Basics')).toBeInTheDocument()
    expect(screen.getByText('Accent')).toBeInTheDocument()
    expect(screen.getByRole('region', {name: 'Preview'})).toBeInTheDocument()
    expect(screen.getByRole('region', {name: 'RCON'})).toBeInTheDocument()
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', {name: 'Save'})).not.toBeInTheDocument()
  })

  it('warns when the text colour has too little contrast with the accent', async () => {
    mockApi()
    renderWithStore(<ServerEditor id="s1" canEdit canRcon={false} />)
    const accent = await screen.findByLabelText('Accent')
    expect(screen.queryByText('Low contrast')).not.toBeInTheDocument()
    fireEvent.change(accent, {target: {value: '#ffffff'}})
    fireEvent.change(screen.getByLabelText('Text color'), {target: {value: '#ffc857'}})
    expect(await screen.findByText('Low contrast')).toBeInTheDocument()
  })

  it('locks the slug while the server is enabled', async () => {
    mockApi()
    renderWithStore(<ServerEditor id="s1" canEdit canRcon={false} />)
    expect(await screen.findByLabelText('Slug')).toHaveAttribute('readonly')
    expect(screen.getByText('Disable the server to change its slug.')).toBeInTheDocument()
  })

  it('saves with the version it loaded', async () => {
    let sent: unknown
    mockApi((_m, body) => {
      sent = body
      return Response.json({...survival, version: 5})
    })
    renderWithStore(<ServerEditor id="s1" canEdit canRcon={false} />)
    fireEvent.change(await screen.findByLabelText('Name'), {target: {value: 'Survival+'}})
    fireEvent.click(screen.getByRole('button', {name: 'Save'}))
    await waitFor(() => {
      expect(sent).toMatchObject({name: 'Survival+', version: 4})
    })
    expect(await findToast()).toHaveTextContent('Saved. Live on the site within a minute.')
  })

  it('shows a refused save other than 409 as an error toast', async () => {
    mockApi(() => Response.json({statusCode: 403, message: 'forbidden'}, {status: 403}))
    renderWithStore(<ServerEditor id="s1" canEdit canRcon={false} />)
    fireEvent.change(await screen.findByLabelText('Name'), {target: {value: 'Survival+'}})
    fireEvent.click(screen.getByRole('button', {name: 'Save'}))
    expect(await findToast('alert')).toHaveTextContent('Error')
    expect(screen.getAllByRole('alert')).toHaveLength(1)
  })

  it('sends the loaded version on every Save after a 409', async () => {
    const sent: unknown[] = []
    mockApi((_m, body) => {
      sent.push(body)
      return Response.json({statusCode: 409, message: 'stale'}, {status: 409})
    })
    renderWithStore(<ServerEditor id="s1" canEdit canRcon={false} />)
    fireEvent.change(await screen.findByLabelText('Name'), {target: {value: 'Survival+'}})
    fireEvent.click(screen.getByRole('button', {name: 'Save'}))
    await screen.findByRole('alert')
    fireEvent.click(screen.getByRole('button', {name: 'Save'}))
    await waitFor(() => {
      expect(sent).toHaveLength(2)
    })
    expect(sent[0]).toMatchObject({version: 4})
    expect(sent[1]).toMatchObject({version: 4})
  })

  it('shows the RCON panel only with server.rcon', async () => {
    mockApi()
    const {unmount} = renderWithStore(<ServerEditor id="s1" canEdit canRcon={false} />)
    await screen.findByLabelText('Name')
    expect(screen.queryByRole('heading', {name: 'RCON'})).not.toBeInTheDocument()
    unmount()
    renderWithStore(<ServerEditor id="s1" canEdit canRcon />)
    expect(await screen.findByRole('heading', {name: 'RCON'})).toBeInTheDocument()
  })
})
