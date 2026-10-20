'use client'

import {Search} from 'lucide-react'
import {useTranslations} from 'next-intl'
import {useRouter} from 'next/navigation'
import {useState} from 'react'

export function GlobalSearch() {
  const t = useTranslations('shell')
  const router = useRouter()
  const [q, setQ] = useState('')
  return (
    <form
      role="search"
      className="relative max-w-md flex-1"
      onSubmit={e => {
        e.preventDefault()
        router.push('/orders?q=' + encodeURIComponent(q.trim()))
      }}>
      <Search
        aria-hidden
        className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted"
      />
      <input
        type="search"
        aria-label={t('searchOrders')}
        placeholder={t('searchOrders')}
        value={q}
        onChange={e => {
          setQ(e.target.value)
        }}
        className="h-10 w-full rounded-full bg-surface pr-4 pl-10 text-sm text-fg placeholder:text-muted focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
      />
    </form>
  )
}
