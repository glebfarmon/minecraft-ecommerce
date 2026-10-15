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
})
