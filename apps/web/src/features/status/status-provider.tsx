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
        const body = (await res.json()) as {online: boolean; players: number}
        if (!controller.signal.aborted) setPlayers(body.online ? body.players : null)
      } catch {
        if (!controller.signal.aborted) setPlayers(null)
      }
    }
    void load()
    const timer = setInterval(() => {
      void load()
    }, POLL_MS)
    return () => {
      controller.abort()
      clearInterval(timer)
    }
  }, [])

  return <StatusContext value={players}>{children}</StatusContext>
}

export function useOnlinePlayers() {
  return useContext(StatusContext)
}
