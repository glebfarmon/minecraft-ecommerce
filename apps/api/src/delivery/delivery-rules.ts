import type {DeliveryStatus, PublicDeliveryState} from '@shop/shared/delivery'
import {NICK_PATTERN, type OrderStatus} from '@shop/shared/orders'

export const MAX_ATTEMPTS = 10

const DAY_MS = 86_400_000
const RETRY_DELAYS_MS = [10_000, 60_000, 300_000, 900_000, 3_600_000] as const

/** Replaces `{nick}` and repeats the whole list `times` times, in order. */
export function renderCommands(
  templates: readonly string[],
  nick: string,
  times: number
): string[] {
  if (!NICK_PATTERN.test(nick)) throw new Error('invalid_nick')
  const once = templates.map(t => t.replaceAll('{nick}', nick))
  return Array.from({length: times}, () => once).flat()
}

/** `attempt` is the number of failed attempts so far (1-based). */
export function retryDelayMs(attempt: number): number {
  const i = Math.min(Math.max(attempt, 1), RETRY_DELAYS_MS.length) - 1
  return RETRY_DELAYS_MS[i] ?? 3_600_000
}

export type SendOutcome =
  | {kind: 'done'; replies: string[]}
  | {kind: 'retryable'; replies: string[]; error: string}
  | {kind: 'unconfirmed'; replies: string[]; error: string}

export type Next = {
  status: 'DONE' | 'PENDING' | 'FAILED' | 'NEEDS_REVIEW'
  attempts: number
  nextAttemptAt: Date | null
  lastError: string | null
}

export function decideNext(attemptsBefore: number, outcome: SendOutcome, now: Date): Next {
  const attempts = attemptsBefore + 1
  switch (outcome.kind) {
    case 'done':
      return {status: 'DONE', attempts, nextAttemptAt: null, lastError: null}
    case 'unconfirmed':
      return {status: 'NEEDS_REVIEW', attempts, nextAttemptAt: null, lastError: outcome.error}
    case 'retryable':
      return attempts >= MAX_ATTEMPTS
        ? {status: 'FAILED', attempts, nextAttemptAt: null, lastError: outcome.error}
        : {
            status: 'PENDING',
            attempts,
            nextAttemptAt: new Date(now.getTime() + retryDelayMs(attempts)),
            lastError: outcome.error
          }
  }
}

/** New expiry of a grant: extends an active grant, otherwise starts at `now`. */
export function grantExpiry(
  current: {expiresAt: Date | null; revokedAt: Date | null},
  now: Date,
  durationDays: number,
  quantity: number
): Date {
  const active = current.revokedAt === null && current.expiresAt !== null && current.expiresAt > now
  const start = active && current.expiresAt ? current.expiresAt : now
  return new Date(start.getTime() + durationDays * quantity * DAY_MS)
}

export function publicDeliveryState(
  orderStatus: OrderStatus,
  statuses: readonly DeliveryStatus[]
): PublicDeliveryState {
  if ((orderStatus !== 'PAID' && orderStatus !== 'DELIVERED') || statuses.length === 0)
    return 'none'
  if (statuses.some(s => s === 'FAILED' || s === 'NEEDS_REVIEW')) return 'delayed'
  if (statuses.every(s => s === 'DONE')) return 'delivered'
  return 'delivering'
}
