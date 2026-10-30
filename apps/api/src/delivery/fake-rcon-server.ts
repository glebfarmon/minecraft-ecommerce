import {type Server, type Socket, createServer} from 'node:net'

export type FakeRconMode = 'normal' | 'refuse-auth' | 'drop' | 'silent'

const TYPE_COMMAND = 2 // also the auth response type
const TYPE_AUTH = 3

const encode = (id: number, type: number, body: string) => {
  const payload = Buffer.from(body, 'utf-8')
  const buf = Buffer.alloc(14 + payload.length)
  buf.writeInt32LE(10 + payload.length, 0)
  buf.writeInt32LE(id, 4)
  buf.writeInt32LE(type, 8)
  payload.copy(buf, 12)
  return buf
}

/** A small real TCP server speaking Source RCON, so `rcon-client` talks to it unchanged. */
export class FakeRconServer {
  readonly received: string[] = []
  private readonly server: Server
  private readonly sockets = new Set<Socket>()
  private readonly mode: FakeRconMode
  private readonly password: string
  private readonly ignore: (command: string) => boolean

  constructor(opts: {
    password: string
    mode?: FakeRconMode
    /** Commands this returns true for are read but never answered (normal mode). */
    ignore?: (command: string) => boolean
  }) {
    this.password = opts.password
    this.mode = opts.mode ?? 'normal'
    this.ignore = opts.ignore ?? (command => /silent/i.test(command))
    this.server = createServer(socket => {
      this.handle(socket)
    })
  }

  /** The bound port; meaningful after `listen`. */
  get port(): number {
    const address = this.server.address()
    return typeof address === 'object' && address ? address.port : 0
  }

  listen(port: number): Promise<void> {
    return new Promise((resolve, reject) => {
      this.server.once('error', reject)
      this.server.listen(port, '127.0.0.1', () => {
        this.server.off('error', reject)
        resolve()
      })
    })
  }

  close(): Promise<void> {
    for (const socket of this.sockets) socket.destroy()
    return new Promise(resolve => {
      if (!this.server.listening) resolve()
      else
        this.server.close(() => {
          resolve()
        })
    })
  }

  /** Resolves once the number of open client connections equals `count`. */
  async waitForClients(count: number, timeoutMs = 1000): Promise<void> {
    const until = Date.now() + timeoutMs
    while (this.sockets.size !== count) {
      if (Date.now() > until) throw new Error(`clients still open: ${String(this.sockets.size)}`)
      await new Promise(r => setTimeout(r, 10))
    }
  }

  private handle(socket: Socket) {
    this.sockets.add(socket)
    socket.on('close', () => this.sockets.delete(socket))
    socket.on('error', () => undefined)
    let buffer = Buffer.alloc(0)
    socket.on('data', (chunk: Buffer) => {
      buffer = Buffer.concat([buffer, chunk])
      while (buffer.length >= 4) {
        const size = buffer.readInt32LE(0)
        if (buffer.length < size + 4) return
        const id = buffer.readInt32LE(4)
        const type = buffer.readInt32LE(8)
        const body = buffer.subarray(12, 4 + size - 2).toString('utf-8')
        buffer = buffer.subarray(size + 4)
        if (type === TYPE_AUTH) {
          const ok = this.mode !== 'refuse-auth' && body === this.password
          socket.write(encode(ok ? id : -1, TYPE_COMMAND, ''))
        } else if (type === TYPE_COMMAND) {
          this.received.push(body)
          if (this.mode === 'drop') {
            socket.destroy()
            return
          }
          if (this.mode === 'silent' || this.ignore(body)) continue
          socket.write(encode(id, 0, `ok: ${body}`))
        }
      }
    })
  }
}
