import {renderWithStore} from '@/test/render-with-store'
import {fireEvent, screen, waitFor} from '@testing-library/react'

import {RconPanel} from './rcon-panel'

const server = {
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

describe('RconPanel', () => {
  it('never shows the password, only that one is set', () => {
    renderWithStore(<RconPanel server={server} />)
    expect(screen.getByLabelText('New password')).toHaveValue('')
    expect(screen.getByText('A password is set.')).toBeInTheDocument()
  })

  it('sends a new password only when typed', async () => {
    let sent: unknown
    jest.spyOn(global, 'fetch').mockImplementation(async (input, init) => {
      const req = input instanceof Request ? input : new Request(String(input), init)
      sent = await req.json()
      return Response.json(server)
    })
    renderWithStore(<RconPanel server={server} />)
    fireEvent.click(screen.getByRole('button', {name: 'Save RCON'}))
    await waitFor(() => {
      expect(sent).toEqual({host: 'mc.example.com', port: 25575})
    })
  })

  it('clears the password field after a successful save', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue(Response.json(server))
    renderWithStore(<RconPanel server={server} />)
    fireEvent.change(screen.getByLabelText('New password'), {target: {value: 'hunter2'}})
    fireEvent.click(screen.getByRole('button', {name: 'Save RCON'}))
    await waitFor(() => {
      expect(screen.getByLabelText('New password')).toHaveValue('')
    })
  })

  it('shows a test result', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue(Response.json({ok: false, error: 'auth_failed'}))
    renderWithStore(<RconPanel server={server} />)
    fireEvent.click(screen.getByRole('button', {name: 'Test connection'}))
    expect(await screen.findByRole('status')).toHaveTextContent('Wrong RCON password.')
  })

  it('explains an internal address', async () => {
    jest
      .spyOn(global, 'fetch')
      .mockResolvedValue(
        Response.json({statusCode: 400, message: 'rcon_host_private'}, {status: 400})
      )
    renderWithStore(<RconPanel server={server} />)
    fireEvent.click(screen.getByRole('button', {name: 'Save RCON'}))
    expect(await screen.findByRole('alert')).toHaveTextContent('public address')
  })
})
