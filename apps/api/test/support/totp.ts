import {generateSync} from 'otplib'

const STEP_S = 30
const used = new Map<string, Set<number>>()

/**
 * A TOTP code this process has not sent yet. The API refuses a code it already accepted for the
 * user (replay guard, 90 s), so tests that sign the same person in again take the current step,
 * then the next one (still accepted, window ±1), and wait for a new step when both are spent.
 */
export async function freshTotp(secret: string): Promise<string> {
  const taken = used.get(secret) ?? new Set<number>()
  used.set(secret, taken)
  for (;;) {
    const step = Math.floor(Date.now() / 1000 / STEP_S)
    const free = [step, step + 1].find(s => !taken.has(s))
    if (free !== undefined) {
      taken.add(free)
      return generateSync({secret, epoch: free * STEP_S})
    }
    await new Promise(resolve => setTimeout(resolve, (step + 1) * STEP_S * 1000 - Date.now() + 50))
  }
}
