import {FakeRconServer} from './fake-rcon-server'

/** Entry for the e2e container: replies to every command except those containing "silent". */
async function main() {
  const server = new FakeRconServer({password: process.env.FAKE_RCON_PASSWORD ?? 'fake'})
  const port = Number(process.env.FAKE_RCON_PORT ?? 25575)
  await server.listen(port)
  console.log(`fake RCON listening on ${String(port)}`)
  const stop = () => {
    void server.close().then(() => process.exit(0))
  }
  process.on('SIGTERM', stop)
  process.on('SIGINT', stop)
}

void main()
