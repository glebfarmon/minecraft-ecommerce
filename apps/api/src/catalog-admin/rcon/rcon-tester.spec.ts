import {createServer} from 'node:net'

import {startFakeRcon} from '../../../test/support/fake-rcon'
import {RconClientTester} from './rcon-tester'

describe('RconClientTester', () => {
  let fake: Awaited<ReturnType<typeof startFakeRcon>>
  const tester = new RconClientTester()

  beforeAll(async () => {
    fake = await startFakeRcon('secret')
  })
  afterAll(async () => {
    await fake.stop()
  })

  it('signs in and runs `list`', async () => {
    const result = await tester.test({host: '127.0.0.1', port: fake.port, password: 'secret'}, 5000)
    expect(result).toEqual({ok: true, ms: expect.any(Number) as number})
    expect(fake.commands).toContain('list')
  })

  it('reports a wrong password', async () => {
    await expect(
      tester.test({host: '127.0.0.1', port: fake.port, password: 'wrong'}, 5000)
    ).resolves.toEqual({ok: false, error: 'auth_failed'})
  })

  it('reports a closed port', async () => {
    await expect(
      tester.test({host: '127.0.0.1', port: 1, password: 'secret'}, 5000)
    ).resolves.toEqual({ok: false, error: 'unreachable'})
  })

  it('gives up after the timeout', async () => {
    // TEST-NET-1 is never routed, so the connect hangs until our timeout.
    const result = await tester.test({host: '192.0.2.1', port: 25575, password: 'x'}, 300)
    expect(result).toEqual({ok: false, error: 'timeout'})
  })

  it('times out and closes the socket when the server never answers auth', async () => {
    const closed = (() => {
      let done!: () => void
      const promise = new Promise<void>(resolve => {
        done = resolve
      })
      return {promise, done}
    })()
    const server = createServer(socket => {
      socket.on('error', () => undefined)
      socket.on('close', () => {
        closed.done()
      })
      socket.resume() // read (and discard) so the client's FIN is seen
    })
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
    const {port} = server.address() as {port: number}
    try {
      const started = Date.now()
      const result = await tester.test({host: '127.0.0.1', port, password: 'x'}, 300)
      expect(result).toEqual({ok: false, error: 'timeout'})
      expect(Date.now() - started).toBeLessThan(1500)
      await expect(
        Promise.race([
          closed.promise,
          new Promise((_, reject) =>
            setTimeout(() => {
              reject(new Error('socket left open'))
            }, 500).unref()
          )
        ])
      ).resolves.toBeUndefined()
    } finally {
      await new Promise<void>(resolve =>
        server.close(() => {
          resolve()
        })
      )
    }
  })
})
