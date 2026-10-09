'use client'

import {type CopyStatus, useCopy} from '@/features/rules/hooks/use-copy'
import {Check, Copy, Link2, X} from 'lucide-react'
import {useTranslations} from 'next-intl'
import type {ReactNode} from 'react'

function ActionButton({
  label,
  status,
  icon,
  onClick
}: {
  label: string
  status: CopyStatus
  icon: ReactNode
  onClick: () => void
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      data-status={status}
      onClick={onClick}
      className="grid size-8 place-items-center rounded-full text-muted transition-colors hover:bg-white/5 hover:text-fg focus-visible:outline-2 focus-visible:outline-accent data-[status=copied]:text-online data-[status=failed]:text-danger">
      {status === 'copied' ? (
        <Check className="size-4" />
      ) : status === 'failed' ? (
        <X className="size-4" />
      ) : (
        icon
      )}
    </button>
  )
}

/** Shown on hover or keyboard focus of the rule (parent has `group`); always visible without hover. */
export function RuleActions({
  number,
  plainText,
  href
}: {
  number: string
  plainText: string
  /** Site path with the rule anchor, e.g. `/pl/rules#r-2-3`. */
  href: string
}) {
  const t = useTranslations('rules')
  const text = useCopy()
  const link = useCopy()

  const announcement =
    text.status === 'copied'
      ? t('copied')
      : link.status === 'copied'
        ? t('linkCopied')
        : text.status === 'failed' || link.status === 'failed'
          ? t('copyFailed')
          : ''

  return (
    <div className="flex shrink-0 gap-1 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100 [@media(hover:none)]:opacity-70">
      <ActionButton
        label={t('copyText', {number})}
        status={text.status}
        icon={<Copy className="size-4" />}
        onClick={() => {
          text.copy(`${number}. ${plainText}`)
        }}
      />
      <ActionButton
        label={t('copyLink', {number})}
        status={link.status}
        icon={<Link2 className="size-4" />}
        onClick={() => {
          link.copy(new URL(href, window.location.origin).toString())
        }}
      />
      <span role="status" aria-live="polite" className="sr-only">
        {announcement}
      </span>
    </div>
  )
}
