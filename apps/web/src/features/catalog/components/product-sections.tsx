'use client'

import {COPIED_FLASH_MS} from '@/config/cart'
import type {Entry, Section} from '@/config/products'
import {useTransientFlag} from '@/hooks/use-transient-flag'
import {Check, Copy} from 'lucide-react'
import {useTranslations} from 'next-intl'
import type {ReactNode} from 'react'

/** A titled panel inside the product modal. */
export function Block({
  title,
  className = '',
  children
}: {
  title?: string
  className?: string
  children: ReactNode
}) {
  return (
    <section className={`rounded-[var(--radius-inner)] bg-card p-4 md:p-5 ${className}`}>
      {title && <h3 className="eyebrow-sm">{title}</h3>}
      <div className={title ? 'mt-2.5' : ''}>{children}</div>
    </section>
  )
}

function CommandChip({cmd}: {cmd: string}) {
  const t = useTranslations('product')
  const [copied, flash] = useTransientFlag(COPIED_FLASH_MS)
  return (
    <button
      type="button"
      onClick={() => {
        navigator.clipboard.writeText(cmd).then(
          () => {
            flash()
          },
          () => {
            // Clipboard blocked: the command stays visible for manual copying.
          }
        )
      }}
      aria-label={t('copyCommand', {cmd})}
      className="group relative inline-flex max-w-full items-center gap-2 rounded-lg bg-accent-soft px-2.5 py-1 font-mono text-[13px] font-medium transition-colors hover:bg-accent hover:text-on-accent">
      <span className="truncate">{cmd}</span>
      {copied ? (
        <Check className="size-3.5 shrink-0" />
      ) : (
        <Copy className="size-3.5 shrink-0 opacity-50 group-hover:opacity-100" />
      )}
      <span aria-live="polite" className="sr-only">
        {copied ? t('copied') : ''}
      </span>
    </button>
  )
}

function EntryRow({entry}: {entry: Entry}) {
  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-1.5 border-t border-line py-2.5 first:border-0 first:pt-0 last:pb-0">
      {entry.cmd && <CommandChip cmd={entry.cmd} />}
      {entry.text && (
        <span
          className={`text-sm leading-snug text-fg/80 ${entry.cmd ? 'order-last basis-full' : 'min-w-0 flex-1'}`}>
          {entry.text}
        </span>
      )}
      {entry.cooldown && (
        <span className="tabular ml-auto rounded-full border border-border px-2 py-0.5 text-xs text-muted">
          {entry.cooldown}
        </span>
      )}
    </li>
  )
}

export function SectionBlock({section}: {section: Section}) {
  return (
    <Block title={section.title}>
      <ul>
        {section.entries.map((entry, i) => (
          <EntryRow key={[entry.cmd, entry.text, i].join()} entry={entry} />
        ))}
      </ul>
    </Block>
  )
}
