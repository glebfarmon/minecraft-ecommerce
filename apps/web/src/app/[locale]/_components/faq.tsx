import {FaqHeading, FaqItem, FaqList, FaqMotion} from '@/app/[locale]/_components/faq-motion'
import {useTranslations} from 'next-intl'

const KEYS = ['1', '2', '3', '4'] as const

export function Faq() {
  const t = useTranslations('faq')
  return (
    <section id="faq" aria-labelledby="faq-title" className="border-b border-line">
      <FaqMotion>
        <div className="mx-auto grid max-w-page gap-10 px-[var(--gutter)] py-24 lg:grid-cols-12 lg:gap-6 lg:py-32">
          <FaqHeading
            id="faq-title"
            className="text-[clamp(2rem,4vw,3.5rem)] leading-[1] font-bold tracking-[-0.03em] lg:col-span-4">
            {t('title')}
          </FaqHeading>
          <FaqList className="border-b border-line lg:col-span-7 lg:col-start-6">
            {KEYS.map(key => (
              <FaqItem key={key} question={t(`q${key}`)}>
                {t(`a${key}`)}
              </FaqItem>
            ))}
          </FaqList>
        </div>
      </FaqMotion>
    </section>
  )
}
