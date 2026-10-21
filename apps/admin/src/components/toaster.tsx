'use client'

import {ToneDot} from '@/components/status-dot'
import {X} from 'lucide-react'
import {useTranslations} from 'next-intl'
import {useEffect, useState} from 'react'
import {Toaster as Sonner, toast} from 'sonner'

import {Button} from '@shop/ui/button'

type Tone = 'ok' | 'bad'

const OK_MS = 4000
const ERROR_MS = 8000

function ToastBody({id, tone, text}: {id: string | number; tone: Tone; text: string}) {
  const t = useTranslations('toast')
  return (
    <div
      role={tone === 'bad' ? 'alert' : 'status'}
      className="flex w-full items-start gap-3 rounded-plate border border-border bg-card-raised p-3 pl-4 text-[13px] text-fg shadow-lg">
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-1.5 py-0.5">
        <ToneDot tone={tone} label={tone === 'bad' ? t('error') : t('done')} />
        <span className="min-w-0 break-words">{text}</span>
      </div>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label={t('dismiss')}
        className="size-7 shrink-0"
        onClick={() => {
          toast.dismiss(id)
        }}>
        <X aria-hidden className="size-3.5" />
      </Button>
    </div>
  )
}

/** Transient results: something was copied, saved, published or failed. The text is already translated. */
export const notify = {
  ok(text: string) {
    toast.custom(id => <ToastBody id={id} tone="ok" text={text} />, {duration: OK_MS})
  },
  error(text: string) {
    toast.custom(id => <ToastBody id={id} tone="bad" text={text} />, {duration: ERROR_MS})
  }
}

const DESKTOP = '(min-width: 768px)'

/** Bottom-right from md, top-centre below it (the bottom of a phone belongs to the sheet and the keyboard). */
export function Toaster() {
  const [desktop, setDesktop] = useState(true)
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return
    const query = window.matchMedia(DESKTOP)
    const sync = () => {
      setDesktop(query.matches)
    }
    sync()
    query.addEventListener('change', sync)
    return () => {
      query.removeEventListener('change', sync)
    }
  }, [])
  const t = useTranslations('toast')
  return (
    <Sonner
      theme="dark"
      position={desktop ? 'bottom-right' : 'top-center'}
      visibleToasts={4}
      containerAriaLabel={t('notifications')}
      mobileOffset={{top: 12, left: 16, right: 16}}
    />
  )
}
