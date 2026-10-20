import {useTranslations} from 'next-intl'
import type {ReactNode} from 'react'

/** The centred card every sign-in step sits in, under the brand mark. */
export function AuthCard({title, children}: {title: string; children: ReactNode}) {
  const t = useTranslations('auth')
  return (
    <section className="mx-auto mt-[12vh] flex w-full max-w-sm flex-col items-center gap-6 pb-12">
      <span
        aria-hidden
        className="flex size-12 items-center justify-center rounded-full bg-accent text-lg font-semibold text-on-accent">
        {t('s')}
      </span>
      <div className="flex w-full flex-col gap-6 rounded-card bg-card p-6">
        <h1 className="text-[22px] leading-tight font-semibold">{title}</h1>
        {children}
      </div>
    </section>
  )
}
