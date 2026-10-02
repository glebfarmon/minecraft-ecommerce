import {
  HowBody,
  HowFade,
  HowHeading,
  HowMotion,
  HowStep,
  HowWord
} from '@/app/[locale]/_components/how-it-works-motion'
import {useTranslations} from 'next-intl'

export function HowItWorks() {
  const t = useTranslations('how')
  const steps = [
    {title: t('step1Title'), body: t('step1')},
    {title: t('step2Title'), body: t('step2')},
    {title: t('step3Title'), body: t('step3')}
  ]

  return (
    <section aria-labelledby="how-title" className="border-b border-line">
      <HowMotion>
        <div className="mx-auto max-w-[1440px] px-[var(--gutter)] py-24 lg:py-32">
          <HowHeading
            id="how-title"
            className="max-w-[18ch] text-[clamp(2rem,4vw,3.5rem)] leading-[1] font-bold tracking-[-0.03em]">
            {t.rich('title', {accent: chunks => <span className="text-accent">{chunks}</span>})}
          </HowHeading>
          <ol className="mt-14 grid gap-px overflow-hidden rounded-[var(--radius-card)] bg-line md:grid-cols-3">
            {steps.map((step, i) => (
              <HowStep
                key={step.title}
                index={i}
                className="relative flex flex-col gap-6 bg-bg p-8 lg:p-10">
                <span className="flex items-baseline justify-between">
                  <HowWord className="text-[clamp(3rem,6vw,5.5rem)] leading-[0.9] font-bold tracking-[-0.045em] lowercase">
                    {step.title}
                  </HowWord>
                  <HowFade className="tabular font-mono text-sm text-accent">
                    <span aria-hidden>{i + 1}/3</span>
                  </HowFade>
                </span>
                <HowBody className="max-w-[34ch] leading-relaxed text-fg/80">{step.body}</HowBody>
              </HowStep>
            ))}
          </ol>
        </div>
      </HowMotion>
    </section>
  )
}
