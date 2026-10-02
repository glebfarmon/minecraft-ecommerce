'use client'

import {useTransientFlag} from '@/hooks/use-transient-flag'
import {Check, Copy} from 'lucide-react'
import {useTranslations} from 'next-intl'

export function CopyIp({ip, className = ''}: {ip: string; className?: string}) {
  const t = useTranslations('ip')
  const [copied, flash] = useTransientFlag(1500)

  return (
    <button
      type="button"
      onClick={() => {
        navigator.clipboard.writeText(ip).then(
          () => {
            flash()
          },
          () => {
            // Clipboard blocked: the address stays visible for manual copying.
          }
        )
      }}
      aria-label={t('copy', {ip})}
      className={`group flex h-12 items-center gap-3 rounded-full border border-border bg-bg/60 pr-4 pl-5 backdrop-blur-sm transition-colors hover:border-white/30 ${className}`}>
      <span className="font-mono text-sm font-medium tracking-wide uppercase">{ip}</span>
      {copied ? (
        <Check className="size-4 text-online" />
      ) : (
        <Copy className="size-4 text-muted group-hover:text-fg" />
      )}
      <span aria-live="polite" className="sr-only">
        {copied ? t('copied') : ''}
      </span>
    </button>
  )
}
