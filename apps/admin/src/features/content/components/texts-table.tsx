'use client'

import {Card} from '@/components/card'
import {EmptyState} from '@/components/empty-state'
import {Hint} from '@/components/hint'
import {SkeletonRows} from '@/components/skeleton'
import {ToneDot} from '@/components/status-dot'
import {useApiError} from '@/hooks/use-error-text'
import {
  type ListContentMessagesApiResponse,
  useListContentMessagesQuery,
  useResetContentMessageMutation,
  useSetContentMessageMutation
} from '@/lib/api/generated'
import {SearchX} from 'lucide-react'
import {useState} from 'react'

import {Button} from '@shop/ui/button'
import {Input} from '@shop/ui/input'
import {Label} from '@shop/ui/label'
import {Table, TableBody, TableCell, TableHead, TableHeader, TableRow} from '@shop/ui/table'
import {Tabs, TabsContent, TabsList, TabsTrigger} from '@shop/ui/tabs'
import {Textarea} from '@shop/ui/textarea'

type Locale = 'en' | 'pl'
type Message = ListContentMessagesApiResponse[number]

const LONG_TEXT = 80
const STALE_HINT =
  'The default text changed its placeholders or tags. The site shows the default until you save a matching text.'

export function TextsTable() {
  const [locale, setLocale] = useState<Locale>('en')
  const [search, setSearch] = useState('')

  return (
    <Tabs
      value={locale}
      onValueChange={v => {
        setLocale(v as Locale)
      }}>
      <div className="flex flex-wrap items-end gap-4">
        <TabsList aria-label="Language">
          <TabsTrigger value="en">EN</TabsTrigger>
          <TabsTrigger value="pl">PL</TabsTrigger>
        </TabsList>
        <div className="flex flex-col gap-1">
          <Label htmlFor="texts-search">Search texts</Label>
          <Input
            id="texts-search"
            type="search"
            value={search}
            onChange={e => {
              setSearch(e.target.value)
            }}
          />
        </div>
      </div>
      <TabsContent value={locale}>
        <Messages key={locale} locale={locale} search={search} />
      </TabsContent>
    </Tabs>
  )
}

function Messages({locale, search}: {locale: Locale; search: string}) {
  const messages = useListContentMessagesQuery({locale})
  // currentData, not data: while another locale loads, data still holds the previous one.
  const data = messages.currentData
  if (messages.isError)
    return (
      <p role="alert" className="rounded-card bg-card p-5">
        Could not load the texts. Refresh the page.
      </p>
    )
  if (!data) return <SkeletonRows />
  const q = search.trim().toLowerCase()
  const shown = data.filter(
    m =>
      !q ||
      m.key.toLowerCase().includes(q) ||
      m.default.toLowerCase().includes(q) ||
      (m.override ?? '').toLowerCase().includes(q)
  )
  const groups = new Map<string, Message[]>()
  for (const m of shown) groups.set(m.namespace, [...(groups.get(m.namespace) ?? []), m])
  if (groups.size === 0) return <EmptyState icon={SearchX} title="No texts match." />

  return (
    <div className="flex flex-col gap-4">
      {[...groups].map(([namespace, rows]) => (
        <Card key={namespace} title={namespace}>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="hidden md:table-cell">Key</TableHead>
                <TableHead>Default</TableHead>
                <TableHead>Override</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map(m => (
                <TextRow key={`${locale}:${m.key}`} locale={locale} message={m} />
              ))}
            </TableBody>
          </Table>
        </Card>
      ))}
    </div>
  )
}

function TextRow({locale, message}: {locale: Locale; message: Message}) {
  const apiError = useApiError()
  const [set, {isLoading: saving}] = useSetContentMessageMutation()
  const [reset, {isLoading: resetting}] = useResetContentMessageMutation()
  const [draft, setDraft] = useState(message.override ?? '')
  const [error, setError] = useState<string | null>(null)
  const busy = saving || resetting
  const errorId = `override-${locale}-${message.key}-error`
  const fieldProps = {
    'id': `override-${locale}-${message.key}`,
    'value': draft,
    'aria-invalid': error ? true : undefined,
    'aria-describedby': error ? errorId : undefined,
    'onChange': (e: {target: {value: string}}) => {
      setDraft(e.target.value)
    }
  }

  async function onSave() {
    setError(null)
    const result = await set({locale, key: message.key, body: {value: draft}})
    if (result.error) setError(apiError(result.error))
  }

  async function onReset() {
    setError(null)
    const result = await reset({locale, key: message.key})
    if (result.error) setError(apiError(result.error))
    else setDraft('')
  }

  return (
    <TableRow>
      <TableCell className="hidden align-top font-mono text-[12px] text-muted md:table-cell">
        {message.key}
      </TableCell>
      <TableCell className="max-w-xs align-top whitespace-pre-wrap">
        {/* Below md the key column is hidden; the key rides above the default text instead. */}
        <span className="mb-1 block font-mono text-[11px] text-muted md:hidden">{message.key}</span>
        {message.default}
      </TableCell>
      <TableCell className="min-w-40 align-top">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={fieldProps.id} className="sr-only">
            Override for {message.key}
          </Label>
          {message.default.length > LONG_TEXT ? (
            <Textarea {...fieldProps} />
          ) : (
            <Input {...fieldProps} />
          )}
          {(message.override !== null || message.stale) && (
            <span className="flex flex-wrap gap-1.5">
              {message.override !== null && <ToneDot tone="ok" label="changed" />}
              {message.stale && (
                <Hint label={STALE_HINT}>
                  <span
                    tabIndex={0}
                    aria-description={STALE_HINT}
                    className="rounded-full focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none">
                    <ToneDot tone="warn" label="needs update" />
                  </span>
                </Hint>
              )}
            </span>
          )}
          {error && (
            <p id={errorId} role="alert" className="text-xs text-destructive">
              {error}
            </p>
          )}
          <div className="flex gap-2">
            <Button
              variant="outline"
              disabled={busy || draft.trim() === '' || draft === (message.override ?? '')}
              onClick={() => void onSave()}>
              Save
            </Button>
            {message.override !== null && (
              <Button variant="outline" disabled={busy} onClick={() => void onReset()}>
                Reset
              </Button>
            )}
          </div>
        </div>
      </TableCell>
    </TableRow>
  )
}
