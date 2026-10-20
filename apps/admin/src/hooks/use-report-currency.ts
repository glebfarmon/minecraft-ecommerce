import {useSyncExternalStore} from 'react'

import type {Currency} from '@shop/shared/catalog'

const KEY = 'admin.reportCurrency'
const listeners = new Set<() => void>()
/** Only used when the browser refuses storage (private window), so the tabs still switch. */
let unsaved: Currency | null = null

function read(): Currency {
  try {
    const stored = localStorage.getItem(KEY)
    if (stored === 'EUR' || stored === 'PLN') return stored
  } catch {
    // Storage blocked: fall through to the in-memory choice.
  }
  return unsaved ?? 'EUR'
}

function write(currency: Currency): void {
  try {
    localStorage.setItem(KEY, currency)
  } catch {
    unsaved = currency
  }
  for (const listener of listeners) listener()
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/** The dashboard's reporting currency, remembered per browser; EUR on the server and by default. */
export function useReportCurrency(): [Currency, (currency: Currency) => void] {
  const currency = useSyncExternalStore(subscribe, read, () => 'EUR' as const)
  return [currency, write]
}
