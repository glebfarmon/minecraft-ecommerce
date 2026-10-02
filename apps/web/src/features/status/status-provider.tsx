'use client'

import {createContext, useContext, useEffect, useState} from 'react'
import type {ReactNode} from 'react'

const POLL_MS = 60_000

// Player count of the game server; null while loading, offline or unreachable.
const StatusContext = createContext<number | null>(null)

export function StatusProvider({children}: {children: ReactNode}) {
  const [players, setPlayers] = useState<number | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    const load = async () => {
      try {
        const res = await fetch('/api/status', {signal: controller.signal})
        if (!res.ok) throw new Error(`status ${String(res.status)}`)
        const body = (await res.json()) as {online?: unknown; players?: unknown}
        const known = body.online === true && typeof body.players === 'number'
        if (!controller.signal.aborted) setPlayers(known ? (body.players as number) : null)
      } catch {
        if (!controller.signal.aborted) setPlayers(null)
      }
    }
    void load()
    // A hidden tab needs no fresh number; catch up as soon as it is shown again.
    const timer = setInterval(() => {
      if (!document.hidden) void load()
    }, POLL_MS)
    const onVisible = () => {
      if (!document.hidden) void load()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      controller.abort()
      clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [])

  return <StatusContext value={players}>{children}</StatusContext>
}

export function useOnlinePlayers() {
  return useContext(StatusContext)
}
