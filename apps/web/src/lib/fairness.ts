// Provably fair roll as specified in the design spec §10.2. Runs on Web Crypto,
// so the browser computes exactly what the server will.

const encoder = new TextEncoder()

function toHex(buffer: ArrayBuffer) {
  return Array.from(new Uint8Array(buffer), b => b.toString(16).padStart(2, '0')).join('')
}

export async function sha256Hex(text: string) {
  return toHex(await crypto.subtle.digest('SHA-256', encoder.encode(text)))
}

export async function hmacHex(key: string, message: string) {
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    encoder.encode(key),
    {name: 'HMAC', hash: 'SHA-256'},
    false,
    ['sign']
  )
  return toHex(await crypto.subtle.sign('HMAC', cryptoKey, encoder.encode(message)))
}

export type Prize = {id: number; name: string; weight: number}

export type Roll = {hmac: string; x: number; totalWeight: number; roll: number; prize: Prize}

export async function roll(
  serverSeed: string,
  clientSeed: string,
  nonce: number,
  prizes: Prize[]
): Promise<Roll> {
  const hmac = await hmacHex(serverSeed, `${clientSeed}:${String(nonce)}`)
  // First 52 bits = first 13 hex characters; fits a JS number exactly.
  const x = parseInt(hmac.slice(0, 13), 16)
  const sorted = [...prizes].sort((a, b) => a.id - b.id)
  const totalWeight = sorted.reduce((sum, p) => sum + p.weight, 0)
  const value = Math.floor((x / 2 ** 52) * totalWeight)
  let cumulative = 0
  const prize = sorted.find(p => (cumulative += p.weight) > value) ?? sorted.at(-1)
  if (!prize) throw new Error('Prize table is empty')
  return {hmac, x, totalWeight, roll: value, prize}
}
