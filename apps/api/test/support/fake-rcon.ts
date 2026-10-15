import {type AddressInfo, type Socket, createServer} from 'node:net'

/** One Source-RCON packet: size, id, type, body, two NUL bytes. */
const packet = (id: number, type: number, body: string): Buffer => {
  const payload = Buffer.from(body, 'utf8')
  const buf = Buffer.alloc(14 + payload.length)
  buf.writeInt32LE(10 + payload.length, 0)
  buf.writeInt32LE(id, 4)
  buf.writeInt32LE(type, 8)
  payload.copy(buf, 12)
  return buf
}

/** A Minecraft-like RCON server on 127.0.0.1 that accepts `password` and answers every command. */
export async function startFakeRcon(password: string) {
  const commands: string[] = []
  const sockets = new Set<Socket>()
  const server = createServer(socket => {
    sockets.add(socket)
    socket.on('close', () => sockets.delete(socket))
    socket.on('error', () => undefined)
    let pending = Buffer.alloc(0)
    socket.on('data', chunk => {
      pending = Buffer.concat([pending, Buffer.from(chunk)])
      while (pending.length >= 4) {
        const size = pending.readInt32LE(0)
        if (pending.length < 4 + size) break
        const id = pending.readInt32LE(4)
        const type = pending.readInt32LE(8)
        const body = pending.subarray(12, 4 + size - 2).toString('utf8')
        pending = pending.subarray(4 + size)
        if (type === 3) socket.write(packet(body === password ? id : -1, 2, ''))
        else if (type === 2) {
          commands.push(body)
          socket.write(packet(id, 0, 'There are 0 of a max of 20 players online:'))
        }
      }
    })
  })
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
  return {
    port: (server.address() as AddressInfo).port,
    commands,
    stop: () =>
      new Promise<void>(resolve => {
        for (const s of sockets) s.destroy()
        server.close(() => {
          resolve()
        })
      })
  }
}
