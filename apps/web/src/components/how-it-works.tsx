import { useTranslations } from 'next-intl';

export function HowItWorks() {
  const t = useTranslations('how');
  const steps = [
    { title: t('step1Title'), body: t('step1') },
    { title: t('step2Title'), body: t('step2') },
    { title: t('step3Title'), body: t('step3') },
  ];

  return (
    <section aria-labelledby="how-title" className="border-b border-line">
      <div className="mx-auto max-w-[1440px] px-[var(--gutter)] py-24 lg:py-32">
        <h2
          id="how-title"
          className="max-w-[18ch] text-[clamp(2rem,4vw,3.5rem)] leading-[1] font-bold tracking-[-0.03em]"
        >
          {t('title')}
        </h2>
        <ol className="mt-14 grid gap-px overflow-hidden rounded-[var(--radius-card)] bg-line md:grid-cols-3">
          {steps.map((step, i) => (
            <li key={step.title} className="flex flex-col gap-6 bg-bg p-8 lg:p-10">
              <span className="flex items-baseline justify-between">
                <span className="text-[clamp(3rem,6vw,5.5rem)] leading-[0.9] font-bold tracking-[-0.045em] lowercase">
                  {step.title}
                </span>
                <span aria-hidden className="tabular font-mono text-sm text-accent">
                  {i + 1}/3
                </span>
              </span>
              <p className="max-w-[34ch] leading-relaxed text-fg/80">{step.body}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
