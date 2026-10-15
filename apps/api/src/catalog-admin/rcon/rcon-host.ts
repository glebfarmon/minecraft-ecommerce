import {lookup} from 'node:dns/promises'
import {BlockList, isIP} from 'node:net'

/** The admin picked an address inside our network (spec decision #13). */
export class RconHostPrivateError extends Error {}

const internal = new BlockList()
for (const [net, prefix] of [
  ['0.0.0.0', 8],
  ['10.0.0.0', 8],
  ['100.64.0.0', 10],
  ['127.0.0.0', 8],
  ['169.254.0.0', 16],
  ['172.16.0.0', 12],
  ['192.168.0.0', 16],
  ['224.0.0.0', 4],
  ['240.0.0.0', 4]
] as const)
  internal.addSubnet(net, prefix, 'ipv4')
internal.addAddress('::', 'ipv6')
internal.addAddress('::1', 'ipv6')
internal.addSubnet('fc00::', 7, 'ipv6')
internal.addSubnet('fe80::', 10, 'ipv6')
internal.addSubnet('ff00::', 8, 'ipv6')

/** Loopback, private, CGNAT, link-local, unique-local or multicast; IPv4-mapped IPv6 included. */
export function isPrivateAddress(ip: string): boolean {
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(ip)?.[1]
  if (mapped) return internal.check(mapped, 'ipv4')
  return internal.check(ip, isIP(ip) === 6 ? 'ipv6' : 'ipv4')
}

/**
 * The address to connect to. Every address the name resolves to must be public, and the caller
 * connects to the returned IP, so a second lookup cannot swap in an internal one.
 */
export async function resolveRconHost(
  host: string,
  allowPrivate = process.env.RCON_ALLOW_PRIVATE_HOSTS === 'true'
): Promise<string> {
  const addresses = isIP(host) ? [{address: host}] : await lookup(host, {all: true})
  const first = addresses[0]?.address
  if (!first) throw new Error(`no address for ${host}`)
  if (!allowPrivate && addresses.some(a => isPrivateAddress(a.address)))
    throw new RconHostPrivateError(host)
  return first
}
