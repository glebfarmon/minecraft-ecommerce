'use client'

import {Skeleton} from '@/components/skeleton'
import {notify} from '@/components/toaster'
import {editionDate} from '@/features/content/lib/edition-date'
import {RESTORE_RULES_KEY} from '@/features/content/lib/rules-form'
import {useApiError} from '@/hooks/use-error-text'
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
/** `skeleton`: the route's loading state, this layout with placeholders. */
export function VersionsList({skeleton = false}: {skeleton?: boolean}) {
  const t = useTranslations('content')
  const apiError = useApiError()
  const first = useListRulesVersionsQuery({})
  // The editor takes the restored draft from this shared mutation state.
  const [restore, {isLoading: restoring}] = useRestoreRulesVersionMutation({
    fixedCacheKey: RESTORE_RULES_KEY
  })

  async function onRestore(id: number) {
    const result = await restore({id: String(id)})
    if (result.error) notify.error(apiError(result.error))
    else notify.ok(t('restoredToTheDraftAbovePublish'))
  }

  return (
    <section
      aria-labelledby="rules-versions"
      className="flex flex-col gap-4 rounded-card bg-card p-5">
      <h2 id="rules-versions" className="text-[15px] font-semibold">
        {t('publishedEditions')}
      </h2>
      {(first.isLoading || skeleton) && (
        <ul aria-hidden className="flex flex-col gap-1.5">
          {Array.from({length: 3}, (_, i) => (
            <li
              key={i}
              className="flex h-[62px] items-center gap-4 rounded-plate bg-card-raised px-4">
              <div className="mr-auto flex flex-col gap-2">
                <Skeleton className="skeleton-on-raised h-3.5 w-36 rounded-full" />
                <Skeleton className="skeleton-on-raised h-3 w-24 rounded-full" />
              </div>
              <Skeleton className="skeleton-on-raised h-9 w-24 rounded-full" />
            </li>
          ))}
        </ul>
      )}
      {!skeleton && first.isError && <p role="alert">{t('couldNotLoadTheEditionsRefresh')}</p>}
      {!skeleton && first.data?.versions.length === 0 && (
        <p className="text-[13px] text-muted">{t('nothingPublishedYet')}</p>
      )}
      {!skeleton && first.data && first.data.versions.length > 0 && (
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
