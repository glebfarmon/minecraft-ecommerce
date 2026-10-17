'use client'

import {editionDate} from '@/features/content/lib/edition-date'
import {RESTORE_RULES_KEY} from '@/features/content/lib/rules-form'
import {apiErrorMessage} from '@/lib/api/error-message'
import {
  type ListRulesVersionsApiResponse,
  useListRulesVersionsQuery,
  useRestoreRulesVersionMutation
} from '@/lib/api/generated'
import {useState} from 'react'

import {Button} from '@shop/ui/button'

type Version = ListRulesVersionsApiResponse['versions'][number]
type Restore = (id: number) => Promise<void>

/** Published editions, newest first, each one restorable into the draft. */
export function VersionsList() {
  const first = useListRulesVersionsQuery({})
  // The editor takes the restored draft from this shared mutation state.
  const [restore, {isLoading: restoring}] = useRestoreRulesVersionMutation({
    fixedCacheKey: RESTORE_RULES_KEY
  })
  const [error, setError] = useState<string | null>(null)
  const [restored, setRestored] = useState(false)

  async function onRestore(id: number) {
    setError(null)
    setRestored(false)
    const result = await restore({id: String(id)})
    if (result.error) setError(apiErrorMessage(result.error))
    else setRestored(true)
  }

  return (
    <section aria-labelledby="rules-versions" className="flex max-w-3xl flex-col gap-3">
      <h2 id="rules-versions" className="text-lg font-semibold">
        Published editions
      </h2>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      {restored && (
        <p role="status" className="text-sm">
          Restored to the draft above. Publish it to show it on the site.
        </p>
      )}
      {first.isLoading && <p className="text-sm text-muted-foreground">Loading editions…</p>}
      {first.isError && <p role="alert">Could not load the editions. Refresh the page.</p>}
      {first.data?.versions.length === 0 && (
        <p className="text-sm text-muted-foreground">Nothing published yet.</p>
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
  // Cursors of the pages loaded after the first one.
  const [cursors, setCursors] = useState<string[]>([])
  const last = cursors.at(-1)
  // Same cache entry as the last <MorePage>, so this only reads its next cursor.
  const lastPage = useListRulesVersionsQuery({cursor: last}, {skip: last === undefined})
  const next = last === undefined ? first.nextCursor : lastPage.data?.nextCursor

  return (
    <>
      <ul
        aria-label="Published editions"
        className="divide-y rounded-lg border [&>li]:px-4 [&>li]:py-3">
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
          Load more
        </Button>
      )}
    </>
  )
}

function MorePage({cursor, busy, onRestore}: {cursor: string; busy: boolean; onRestore: Restore}) {
  const page = useListRulesVersionsQuery({cursor})
  if (page.isError)
    return (
      <li role="alert" className="text-sm">
        Could not load more editions. Refresh the page.
      </li>
    )
  return page.data?.versions.map(v => (
    <Row key={v.id} version={v} busy={busy} onRestore={onRestore} />
  ))
}

function Row({version, busy, onRestore}: {version: Version; busy: boolean; onRestore: Restore}) {
  const [confirming, setConfirming] = useState(false)

  return (
    <li className="flex flex-wrap items-center gap-x-4 gap-y-2">
      <div className="mr-auto flex flex-col">
        <span className="font-medium">{editionDate(version.publishedAt)}</span>
        <span className="text-xs text-muted-foreground">{`by ${version.publishedBy}`}</span>
      </div>
      {confirming ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm">Replace the draft with this edition?</span>
          <Button
            type="button"
            disabled={busy}
            onClick={() => {
              setConfirming(false)
              void onRestore(version.id)
            }}>
            Restore
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setConfirming(false)
            }}>
            Cancel
          </Button>
        </div>
      ) : (
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            setConfirming(true)
          }}>
          Restore to draft
        </Button>
      )}
    </li>
  )
}
