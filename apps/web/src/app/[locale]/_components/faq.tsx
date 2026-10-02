import {Plus} from 'lucide-react'
import {useTranslations} from 'next-intl'

const KEYS = ['1', '2', '3', '4'] as const

export function Faq() {
  const t = useTranslations('faq')
  return (
    <section id="faq" aria-labelledby="faq-title" className="border-b border-line">
      <div className="mx-auto grid max-w-[1440px] gap-10 px-[var(--gutter)] py-24 lg:grid-cols-12 lg:gap-6 lg:py-32">
        <h2
          id="faq-title"
          className="text-[clamp(2rem,4vw,3.5rem)] leading-[1] font-bold tracking-[-0.03em] lg:col-span-4">
          {t('title')}
        </h2>
        <div className="divide-y divide-line border-y border-line lg:col-span-7 lg:col-start-6">
          {KEYS.map(key => (
            <details key={key} className="group">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-6 rounded-xl py-6 text-lg font-medium tracking-[-0.01em] [&::-webkit-details-marker]:hidden">
                {t(`q${key}`)}
                <Plus
                  aria-hidden
                  className="size-5 shrink-0 text-muted transition-transform duration-300 group-open:rotate-45 group-open:text-accent"
                />
              </summary>
              <p className="max-w-[62ch] pb-6 leading-relaxed text-fg/75">{t(`a${key}`)}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  )
}
