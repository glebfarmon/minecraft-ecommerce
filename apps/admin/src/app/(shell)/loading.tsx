import {useTranslations} from 'next-intl'

/**
 * Every shell page renders on request (the session), so without a boundary a click waits for the
 * whole page before anything changes. This fallback is prefetched: the old page goes at once. It
 * draws nothing, because it also covers sections whose layout is still on its way (content,
 * catalog), and a placeholder here would have another page's shape; each page's own
 * `loading.tsx` shows its layout once the section is in.
 */
export default function ShellLoading() {
  const t = useTranslations('common')
  return (
    <span role="status" className="sr-only">
      {t('loading')}
    </span>
  )
}
