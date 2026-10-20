'use client'

import {editionDate} from '@/features/content/lib/edition-date'
import {RESTORE_RULES_KEY} from '@/features/content/lib/rules-form'
import {useApiError} from '@/hooks/use-error-text'
import {useMessage} from '@/hooks/use-message'
import {
  type ListRulesVersionsApiResponse,
  useListRulesVersionsQuery,
  useRestoreRulesVersionMutation
} from '@/lib/api/generated'
import {useLocale, useTranslations} from 'next-intl'
import {useState} from 'react'

import {Button} from '@shop/ui/button'

type Version = ListRulesVersionsApiResponse['versions'][number]
type Restore = (id: number) => Promise<void>

/** Published editions, newest first, each one restorable into the draft. */
export function VersionsList() {
  const t = useTranslations('content')
  const apiError = useApiError()
  const first = useListRulesVersionsQuery({})
  // The editor takes the restored draft from this shared mutation state.
  const [restore, {isLoading: restoring}] = useRestoreRulesVersionMutation({
    fixedCacheKey: RESTORE_RULES_KEY
  })
  const [error, setError] = useMessage()
  const [restored, setRestored] = useState(false)

  async function onRestore(id: number) {
    setError(null)
    setRestored(false)
    const result = await restore({id: String(id)})
    if (result.error) setError(apiError(result.error))
    else setRestored(true)
  }

  return (
    <section
      aria-labelledby="rules-versions"
      className="flex flex-col gap-4 rounded-card bg-card p-5">
      <h2 id="rules-versions" className="text-[15px] font-semibold">
        {t('publishedEditions')}
      </h2>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      {restored && (
        <p role="status" className="text-sm">
          {t('restoredToTheDraftAbovePublish')}
        </p>
      )}
      {first.isLoading && <p className="text-[13px] text-muted">{t('loadingEditions')}</p>}
      {first.isError && <p role="alert">{t('couldNotLoadTheEditionsRefresh')}</p>}
      {first.data?.versions.length === 0 && (
        <p className="text-[13px] text-muted">{t('nothingPublishedYet')}</p>
      )}
      {first.data && first.data.versions.length > 0 && (
        // A new publish changes the newest edition: start again from the first page.
        <Pages
          key={first.data.versions[0]?.id}
          first={first.data}
          busy={restoring}
          onRestore={onRestore}
        />
      )}
    </section>
  )
}

function Pages({
  first,
  busy,
  onRestore
}: {
  first: ListRulesVersionsApiResponse
  busy: boolean
  onRestore: Restore
}) {
  const t = useTranslations('content')
  // Cursors of the pages loaded after the first one.
  const [cursors, setCursors] = useState<string[]>([])
  const last = cursors.at(-1)
  // Same cache entry as the last <MorePage>, so this only reads its next cursor.
  const lastPage = useListRulesVersionsQuery({cursor: last}, {skip: last === undefined})
  const next = last === undefined ? first.nextCursor : lastPage.data?.nextCursor

  return (
    <>
      <ul
        aria-label={t('publishedEditions')}
        className="flex flex-col gap-1.5 [&>li]:rounded-plate [&>li]:bg-card-raised [&>li]:px-4 [&>li]:py-3">
        {first.versions.map(v => (
          <Row key={v.id} version={v} busy={busy} onRestore={onRestore} />
        ))}
        {cursors.map(cursor => (
          <MorePage key={cursor} cursor={cursor} busy={busy} onRestore={onRestore} />
        ))}
      </ul>
      {next !== null && next !== undefined && (
        <Button
          type="button"
          variant="outline"
          className="w-fit"
          disabled={lastPage.isFetching}
          onClick={() => {
            setCursors(c => [...c, String(next)])
          }}>
          {t('loadMore')}
        </Button>
      )}
    </>
  )
}

function MorePage({cursor, busy, onRestore}: {cursor: string; busy: boolean; onRestore: Restore}) {
  const t = useTranslations('content')
  const page = useListRulesVersionsQuery({cursor})
  if (page.isError)
    return (
      <li role="alert" className="text-sm">
        {t('couldNotLoadMoreEditionsRefresh')}
      </li>
    )
  return page.data?.versions.map(v => (
    <Row key={v.id} version={v} busy={busy} onRestore={onRestore} />
  ))
}

function Row({version, busy, onRestore}: {version: Version; busy: boolean; onRestore: Restore}) {
  const t = useTranslations('content')
  const uiLocale = useLocale()
  const [confirming, setConfirming] = useState(false)

  return (
    <li className="flex flex-wrap items-center gap-x-4 gap-y-2">
      <div className="mr-auto flex flex-col">
        <span className="font-medium">{editionDate(version.publishedAt, uiLocale)}</span>
        <span className="text-[12px] text-muted">{`by ${version.publishedBy}`}</span>
      </div>
      {confirming ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm">{t('replaceTheDraftWithThisEdition')}</span>
          <Button
            type="button"
            disabled={busy}
            onClick={() => {
              setConfirming(false)
              void onRestore(version.id)
            }}>
            {t('restore')}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setConfirming(false)
            }}>
            {t('cancel')}
          </Button>
        </div>
      ) : (
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            setConfirming(true)
          }}>
          {t('restoreToDraft')}
        </Button>
      )}
    </li>
  )
}
