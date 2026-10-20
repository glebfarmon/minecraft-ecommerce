import {useTranslations} from 'next-intl'

/** The placeholders a command may use; the API refuses any other (`{nick}`-only, spec §5). */
export function CommandHelp({onInsert}: {onInsert: (token: string) => void}) {
  const t = useTranslations('catalog')
  return (
    <div className="flex flex-col gap-2 rounded-plate bg-card-raised p-4 text-[13px] md:col-span-2">
      <p className="label-caps">{t('variables')}</p>
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          aria-label={t('insertNick')}
          onMouseDown={e => {
            // Keep the caret in the textarea the admin was typing in.
            e.preventDefault()
          }}
          onClick={() => {
            onInsert('{nick}')
          }}
          className="rounded-full bg-accent-soft px-2.5 py-0.5 font-mono text-[12px] text-accent transition-colors hover:bg-accent hover:text-on-accent focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none">
          {'{nick}'}
        </button>
        <span className="text-muted">{t('theBuyersNickname')}</span>
      </div>
      <p className="text-muted">
        {t('example')} <code className="font-mono text-fg">give {'{nick}'} diamond 1</code>
      </p>
    </div>
  )
}
