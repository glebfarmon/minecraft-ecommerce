'use client'

import {AlertCircle, LoaderCircle, TicketPercent, X} from 'lucide-react'
import {AnimatePresence, motion, useReducedMotion} from 'motion/react'
import {useTranslations} from 'next-intl'
import {useId, useRef, useState} from 'react'

import type {PromoReason} from '@shop/shared/promo'

/** Every reason the field can show: the API's, plus the two the request itself can end with. */
export type PromoFieldReason = PromoReason | 'network' | 'rate_limited'

const EASE = [0.16, 1, 0.3, 1] as const

type Props = {
  /** The code in force, as the API spelled it; shown as a chip. */
  applied: string | null
  error: PromoFieldReason | null
  /** A check is running (Apply, or a re-check after the cart changed). */
  checking: boolean
  onApply: (code: string) => void
  onRemove: () => void
}

/**
 * The promo code in the order summary: a quiet link until asked for, then an input with Apply,
 * then a chip `CODE ×` once the code is in force. Lives inside the checkout form, so Enter applies
 * the code instead of submitting the order.
 */
export function PromoField({applied, error, checking, onApply, onRemove}: Props) {
  const t = useTranslations('checkout')
  const reduce = useReducedMotion()
  const id = useId()
  const [open, setOpen] = useState(false)
  const [value, setValue] = useState('')
  // Focus moves only after the player's own click, never when a re-check drops the code.
  const focusNext = useRef(false)
  const code = value.trim()
  const shown = applied ? 'chip' : open || error ? 'input' : 'toggle'
  const transition = reduce ? {duration: 0} : {duration: 0.32, ease: EASE}

  const apply = () => {
    if (code && !checking) onApply(code)
  }

  return (
    <div className="mt-4">
      <AnimatePresence mode="popLayout" initial={false}>
        {shown === 'toggle' && (
          <motion.div key="toggle" exit={{opacity: 0}} transition={transition}>
            <button
              type="button"
              onClick={() => {
                focusNext.current = true
                setOpen(true)
              }}
              className="-ml-1 inline-flex h-11 items-center gap-2 rounded-full px-1 text-sm text-muted underline decoration-white/20 underline-offset-4 transition-colors hover:text-fg hover:decoration-accent">
              <TicketPercent className="size-4 shrink-0" aria-hidden="true" />
              {t('promo.toggle')}
            </button>
          </motion.div>
        )}

        {shown === 'input' && (
          <motion.div
            key="input"
            initial={{opacity: 0, y: -4}}
            animate={{opacity: 1, y: 0}}
            exit={{opacity: 0}}
            transition={transition}>
            <label htmlFor={id} className="sr-only">
              {t('promo.label')}
            </label>
            <div className="flex gap-2">
              <input
                id={id}
                ref={el => {
                  if (el && focusNext.current) {
                    focusNext.current = false
                    el.focus()
                  }
                }}
                value={value}
                onChange={e => {
                  setValue(e.target.value)
                }}
                onKeyDown={e => {
                  if (e.key !== 'Enter') return
                  e.preventDefault()
                  apply()
                }}
                maxLength={64}
                autoComplete="off"
                autoCapitalize="characters"
                spellCheck={false}
                enterKeyHint="done"
                aria-invalid={error ? true : undefined}
                aria-describedby={error ? `${id}-error` : undefined}
                placeholder={t('promo.label')}
                className="h-11 min-w-0 flex-1 rounded-[var(--radius-field)] border border-border bg-bg px-3.5 font-mono text-[15px] tracking-[0.06em] text-fg uppercase caret-accent transition-colors outline-none placeholder:font-sans placeholder:tracking-normal placeholder:text-muted/70 placeholder:normal-case hover:border-white/25 focus-visible:border-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent aria-invalid:border-danger"
              />
              <button
                type="button"
                onClick={apply}
                disabled={!code || checking}
                aria-busy={checking || undefined}
                className="relative inline-flex h-11 shrink-0 items-center justify-center rounded-full border border-border px-4 text-sm font-semibold transition-colors hover:border-white/25 hover:bg-surface disabled:opacity-40 disabled:hover:bg-transparent">
                <span className={checking ? 'invisible' : undefined}>{t('promo.apply')}</span>
                {checking && (
                  <LoaderCircle
                    className="absolute size-4 animate-spin motion-reduce:animate-none"
                    aria-hidden="true"
                  />
                )}
              </button>
            </div>
            {error && (
              <p
                id={`${id}-error`}
                role="alert"
                className="mt-2 flex items-start gap-1.5 text-[13px] text-danger">
                <AlertCircle className="mt-px size-3.5 shrink-0" aria-hidden="true" />
                {t(`promo.reasons.${error}`)}
              </p>
            )}
          </motion.div>
        )}

        {shown === 'chip' && applied && (
          <motion.div
            key="chip"
            initial={reduce ? false : {opacity: 0, scale: 0.92}}
            animate={{opacity: 1, scale: 1}}
            exit={{opacity: 0, scale: 0.92}}
            transition={transition}
            className="flex origin-left items-center">
            <span className="inline-flex h-9 items-center gap-2 rounded-full bg-accent-soft pr-1 pl-3 text-accent">
              <TicketPercent className="size-4 shrink-0" aria-hidden="true" />
              <span className="font-mono text-sm font-medium tracking-[0.06em]">{applied}</span>
              <button
                type="button"
                onClick={() => {
                  focusNext.current = true
                  setOpen(true)
                  onRemove()
                }}
                aria-label={t('promo.remove', {code: applied})}
                className="inline-flex size-7 items-center justify-center rounded-full transition-colors hover:bg-accent/20 focus-visible:outline-2 focus-visible:outline-accent">
                <X className="size-3.5" aria-hidden="true" />
              </button>
            </span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
