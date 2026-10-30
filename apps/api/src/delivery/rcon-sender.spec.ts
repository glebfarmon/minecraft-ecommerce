import {FakeRconServer} from './fake-rcon-server'
import {RconClientSender} from './rcon-sender'

describe('RconClientSender', () => {
  const password = 'secret'
  let server: FakeRconServer | undefined
  let port = 0

  const start = async (mode?: 'normal' | 'refuse-auth' | 'drop' | 'silent') => {
    server = new FakeRconServer({password, mode})
    await server.listen(0)
    port = server.port
  }
  const target = () => ({host: '127.0.0.1', port, password})

  afterEach(async () => {
    await server?.close()
    server = undefined
  })

  it('sends all commands and returns replies', async () => {
    await start()
    const outcome = await new RconClientSender().send(target(), ['say a', 'say b'], 1000)
    expect(outcome).toEqual({kind: 'done', replies: ['ok: say a', 'ok: say b']})
    expect(server?.received).toEqual(['say a', 'say b'])
  })

  it('auth refused is retryable with no replies', async () => {
    await start('refuse-auth')
    const outcome = await new RconClientSender().send(target(), ['say a'], 1000)
    expect(outcome).toMatchObject({kind: 'retryable', replies: []})
    expect(server?.received).toEqual([])
  })

  it('connection refused is retryable', async () => {
    await start()
    await server?.close()
    const outcome = await new RconClientSender().send(target(), ['say a'], 1000)
    expect(outcome).toMatchObject({kind: 'retryable', replies: []})
  })

  it('silent server is unconfirmed after the timeout, with replies to earlier commands', async () => {
    await start()
    const outcome = await new RconClientSender().send(
      target(),
      ['say a', 'say SILENT', 'say c'],
      200
    )
    expect(outcome).toMatchObject({kind: 'unconfirmed', replies: ['ok: say a']})
    expect(server?.received).toEqual(['say a', 'say SILENT'])
  })

  it('silent mode never replies', async () => {
    await start('silent')
    const outcome = await new RconClientSender().send(target(), ['say a'], 200)
    expect(outcome).toMatchObject({kind: 'unconfirmed', replies: []})
  })

  it('drop after a write is unconfirmed', async () => {
    await start('drop')
    const outcome = await new RconClientSender().send(target(), ['say a'], 1000)
    expect(outcome).toMatchObject({kind: 'unconfirmed', replies: []})
    expect(server?.received).toEqual(['say a'])
  })

  it('resolves after the last reply and closes the socket', async () => {
    await start()
    await new RconClientSender().send(target(), ['say a'], 1000)
    await expect(server?.waitForClients(0)).resolves.toBeUndefined()
  })

  it('listens on the host it is given', async () => {
    server = new FakeRconServer({password})
    await server.listen(0, '127.0.0.1')
    port = server.port
    const outcome = await new RconClientSender().send(target(), ['say a'], 1000)
    expect(outcome.kind).toBe('done')
    await server.close()
    server = new FakeRconServer({password})
    await expect(server.listen(0, '203.0.113.1')).rejects.toThrow()
  })
})
