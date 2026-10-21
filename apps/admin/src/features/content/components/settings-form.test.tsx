import {renderWithStore} from '@/test/render-with-store'
import {findToast} from '@/test/toast'
import {fireEvent, screen, waitFor} from '@testing-library/react'

import {SettingsForm} from './settings-form'

const settings = {
  siteName: {plain: 'Craft', accent: 'Realm'},
  serverIp: 'play.example.com',
  discordUrl: 'https://discord.gg/abc',
  supportEmail: 'help@example.com',
  version: 3
}

function mockApi(
  write: (method: string, body: unknown) => Response = () => Response.json(settings)
) {
  return jest.spyOn(global, 'fetch').mockImplementation(async (input, init) => {
    const req = input instanceof Request ? input : new Request(String(input), init)
    if (req.method !== 'GET') return write(req.method, await req.json().catch(() => null))
    return Response.json(settings)
  })
}

describe('SettingsForm', () => {
  it('previews the wordmark and saves with the loaded version', async () => {
    let sent: unknown
    mockApi((_m, body) => {
      sent = body
      return Response.json({...settings, version: 4})
    })
    renderWithStore(<SettingsForm canEdit />)
    fireEvent.change(await screen.findByLabelText('Accent part'), {target: {value: 'World'}})
    const preview = screen.getByTestId('wordmark-preview')
    expect(preview).toHaveTextContent('CraftWorld')
    expect(screen.getByText('World')).toHaveAttribute('data-accent')
    fireEvent.click(screen.getByRole('button', {name: 'Save'}))
    expect(await findToast()).toHaveTextContent('Saved. Live on the site within a minute.')
    expect(sent).toMatchObject({
      siteName: {plain: 'Craft', accent: 'World'},
      serverIp: 'play.example.com',
      discordUrl: 'https://discord.gg/abc',
      supportEmail: 'help@example.com',
      version: 3
    })
  })

  it('shows a refused save other than 409 as an error toast and keeps the form quiet', async () => {
    mockApi(() => Response.json({statusCode: 500, message: 'boom'}, {status: 500}))
    renderWithStore(<SettingsForm canEdit />)
    fireEvent.change(await screen.findByLabelText('Site name'), {target: {value: 'Block'}})
    fireEvent.click(screen.getByRole('button', {name: 'Save'}))
    expect(await findToast('alert')).toHaveTextContent('Something went wrong')
    expect(screen.getAllByRole('alert')).toHaveLength(1)
  })

  it('keeps the loaded version after a 409 (two saves both send version 3)', async () => {
    const sent: unknown[] = []
    mockApi((_m, body) => {
      sent.push(body)
      return Response.json({statusCode: 409, message: 'stale'}, {status: 409})
    })
    renderWithStore(<SettingsForm canEdit />)
    const name = await screen.findByLabelText('Site name')
    fireEvent.change(name, {target: {value: 'Block'}})
    fireEvent.click(screen.getByRole('button', {name: 'Save'}))
    expect(await screen.findByRole('alert')).toHaveTextContent('Someone else changed this')
    expect(screen.getByLabelText('Site name')).toHaveValue('Block')
    fireEvent.click(screen.getByRole('button', {name: 'Save'}))
    await waitFor(() => {
      expect(sent).toHaveLength(2)
    })
    expect(sent[0]).toMatchObject({version: 3})
    expect(sent[1]).toMatchObject({version: 3})
  })

  it('shows field errors for a bad email and an http discord link', async () => {
    const fetchMock = mockApi()
    renderWithStore(<SettingsForm canEdit />)
    fireEvent.change(await screen.findByLabelText('Support email'), {target: {value: 'nope'}})
    fireEvent.change(screen.getByLabelText('Discord link'), {
      target: {value: 'http://discord.gg/abc'}
    })
    fireEvent.click(screen.getByRole('button', {name: 'Save'}))
    expect(await screen.findByText('Use an https:// link')).toBeInTheDocument()
    expect(screen.getByLabelText('Discord link')).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByLabelText('Support email')).toHaveAttribute('aria-invalid', 'true')
    expect(
      fetchMock.mock.calls.some(
        ([i, init]) => (i instanceof Request ? i.method : init?.method) === 'PUT'
      )
    ).toBe(false)
  })
})
