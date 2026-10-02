import {StatusService} from './status.service'

const reply = (body: unknown, ok = true) =>
  Promise.resolve({ok, json: () => Promise.resolve(body)} as Response)

describe('StatusService', () => {
  let fetchMock: jest.SpiedFunction<typeof fetch>

  beforeEach(() => {
    jest.useFakeTimers()
    delete process.env.MC_SERVER_ADDRESS
    fetchMock = jest.spyOn(globalThis, 'fetch')
  })

  afterEach(() => {
    jest.useRealTimers()
    jest.restoreAllMocks()
  })

  it('returns the player count of an online server', async () => {
    fetchMock.mockReturnValue(reply({online: true, players: {online: 3587, max: 20000}}))
    await expect(new StatusService().get()).resolves.toEqual({online: true, players: 3587})
  })

  it('asks mcstatus about the configured address', async () => {
    process.env.MC_SERVER_ADDRESS = 'play.example.org:25570'
    fetchMock.mockReturnValue(reply({online: true, players: {online: 1}}))
    await new StatusService().get()
    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      'https://api.mcstatus.io/v2/status/java/play.example.org%3A25570'
    )
  })

  it('defaults to mc.mineblaze.net', async () => {
    fetchMock.mockReturnValue(reply({online: true, players: {online: 1}}))
    await new StatusService().get()
    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      'https://api.mcstatus.io/v2/status/java/mc.mineblaze.net'
    )
  })

  it('reports offline when the server is not online', async () => {
    fetchMock.mockReturnValue(reply({online: false}))
    await expect(new StatusService().get()).resolves.toEqual({online: false, players: 0})
  })

  it('reports offline when online is not strictly true', async () => {
    fetchMock.mockReturnValue(reply({online: 'true', players: {online: 5}}))
    await expect(new StatusService().get()).resolves.toEqual({online: false, players: 0})
  })

  it('reports offline when players.online is missing or not a number', async () => {
    fetchMock.mockReturnValue(reply({online: true, players: {}}))
    await expect(new StatusService().get()).resolves.toEqual({online: false, players: 0})
  })

  it('reports offline on a non-2xx reply', async () => {
    fetchMock.mockReturnValue(reply({}, false))
    await expect(new StatusService().get()).resolves.toEqual({online: false, players: 0})
  })

  it('reports offline when the request fails', async () => {
    fetchMock.mockRejectedValue(new Error('network down'))
    await expect(new StatusService().get()).resolves.toEqual({online: false, players: 0})
  })

  it('serves repeat calls from cache, then refreshes after it expires', async () => {
    fetchMock.mockReturnValue(reply({online: true, players: {online: 10}}))
    const service = new StatusService()
    await service.get()
    await service.get()
    expect(fetchMock).toHaveBeenCalledTimes(1)
    jest.advanceTimersByTime(31_000)
    await service.get()
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('shares one upstream request between concurrent callers', async () => {
    fetchMock.mockReturnValue(reply({online: true, players: {online: 10}}))
    const service = new StatusService()
    await Promise.all([service.get(), service.get(), service.get()])
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})
