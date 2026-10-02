import {act, render, screen, waitFor} from '@testing-library/react'

import {StatusProvider, useOnlinePlayers} from './status-provider'

function Players() {
  const players = useOnlinePlayers()
  return <p>{players === null ? 'unknown' : `players:${String(players)}`}</p>
}

const setup = () =>
  render(
    <StatusProvider>
      <Players />
    </StatusProvider>
  )

const reply = (body: unknown, ok = true) =>
  Promise.resolve({ok, json: () => Promise.resolve(body)} as Response)

describe('StatusProvider', () => {
  const fetchMock = jest.fn<ReturnType<typeof fetch>, Parameters<typeof fetch>>()
  const realFetch = globalThis.fetch

  beforeEach(() => {
    fetchMock.mockReset()
    globalThis.fetch = fetchMock
  })

  afterEach(() => {
    jest.useRealTimers()
    globalThis.fetch = realFetch
  })

  it('is unknown until the status arrives', async () => {
    fetchMock.mockReturnValue(reply({online: true, players: 12}))
    setup()
    expect(screen.getByText('unknown')).toBeInTheDocument()
    expect(await screen.findByText('players:12')).toBeInTheDocument()
    expect(fetchMock.mock.calls[0]?.[0]).toBe('/api/status')
  })

  it('stays unknown when the server is offline', async () => {
    fetchMock.mockReturnValue(reply({online: false, players: 0}))
    setup()
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalled()
    })
    expect(screen.getByText('unknown')).toBeInTheDocument()
  })

  it('stays unknown on a failed request', async () => {
    fetchMock.mockRejectedValue(new Error('no network'))
    setup()
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalled()
    })
    expect(screen.getByText('unknown')).toBeInTheDocument()
  })

  it('refreshes every minute', async () => {
    jest.useFakeTimers()
    fetchMock.mockReturnValueOnce(reply({online: true, players: 1}))
    fetchMock.mockReturnValueOnce(reply({online: true, players: 2}))
    setup()
    await act(async () => {
      await Promise.resolve()
    })
    expect(screen.getByText('players:1')).toBeInTheDocument()
    await act(async () => {
      jest.advanceTimersByTime(60_000)
      await Promise.resolve()
    })
    expect(screen.getByText('players:2')).toBeInTheDocument()
  })

  it('stops polling on unmount', async () => {
    jest.useFakeTimers()
    fetchMock.mockReturnValue(reply({online: true, players: 1}))
    const {unmount} = setup()
    await act(async () => {
      await Promise.resolve()
    })
    unmount()
    jest.advanceTimersByTime(180_000)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('stays unknown when the body has an unexpected shape', async () => {
    fetchMock.mockReturnValue(reply({online: true, players: 'many'}))
    setup()
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalled()
    })
    expect(screen.getByText('unknown')).toBeInTheDocument()
  })

  describe('hidden tab', () => {
    const setHidden = (hidden: boolean) => {
      Object.defineProperty(document, 'hidden', {configurable: true, get: () => hidden})
      document.dispatchEvent(new Event('visibilitychange'))
    }
    afterEach(() => {
      setHidden(false)
    })

    it('skips polls while hidden and refreshes when visible again', async () => {
      jest.useFakeTimers()
      fetchMock.mockReturnValue(reply({online: true, players: 1}))
      setup()
      await act(async () => {
        await Promise.resolve()
      })
      expect(fetchMock).toHaveBeenCalledTimes(1)
      act(() => {
        setHidden(true)
      })
      await act(async () => {
        jest.advanceTimersByTime(120_000)
        await Promise.resolve()
      })
      expect(fetchMock).toHaveBeenCalledTimes(1)
      await act(async () => {
        setHidden(false)
        await Promise.resolve()
      })
      expect(fetchMock).toHaveBeenCalledTimes(2)
    })
  })
})
