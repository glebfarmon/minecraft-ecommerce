import {OnlineDot} from '@/components/online-dot'
import {useTranslations} from 'next-intl'

/** Purchase feed (SSE arrives with the API). The demo has no purchases, so it shows the honest empty state. */
export function LiveFeed() {
  const t = useTranslations('feed')
  return (
    <section aria-labelledby="feed-title" className="border-b border-line">
      <div className="mx-auto flex max-w-[1440px] flex-col gap-4 px-[var(--gutter)] py-10 sm:flex-row sm:items-center sm:gap-8">
        <h2 id="feed-title" className="flex shrink-0 items-center gap-3 text-sm font-semibold">
          <OnlineDot online />
          {t('title')}
          <span className="rounded-full border border-border px-2 py-0.5 text-[11px] tracking-[0.14em] text-muted uppercase">
            {t('live')}
          </span>
        </h2>
        <p className="text-sm text-muted">{t('empty')}</p>
      </div>
    </section>
  )
}
