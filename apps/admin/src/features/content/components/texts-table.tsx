'use client'

import {apiErrorMessage} from '@/lib/api/error-message'
import {
  type ListContentMessagesApiResponse,
  useListContentMessagesQuery,
  useResetContentMessageMutation,
  useSetContentMessageMutation
} from '@/lib/api/generated'
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
  if (messages.isError) return <p role="alert">Could not load the texts. Refresh the page.</p>
  if (!data) return <p>Loading texts…</p>
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
  if (groups.size === 0) return <p>No texts match.</p>

  return (
    <div className="flex flex-col gap-8">
      {[...groups].map(([namespace, rows]) => (
        <section key={namespace} className="flex flex-col gap-2">
          <h3 className="text-lg font-semibold">{namespace}</h3>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Key</TableHead>
                <TableHead>Default</TableHead>
                <TableHead>Override</TableHead>
                <TableHead className="sr-only">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map(m => (
                <TextRow key={`${locale}:${m.key}`} locale={locale} message={m} />
              ))}
            </TableBody>
          </Table>
        </section>
      ))}
    </div>
  )
}

function TextRow({locale, message}: {locale: Locale; message: Message}) {
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
    if (result.error) setError(apiErrorMessage(result.error))
  }

  async function onReset() {
    setError(null)
    const result = await reset({locale, key: message.key})
    if (result.error) setError(apiErrorMessage(result.error))
    else setDraft('')
  }

  return (
    <TableRow>
      <TableCell className="font-mono text-xs">{message.key}</TableCell>
      <TableCell className="max-w-xs text-sm whitespace-pre-wrap">{message.default}</TableCell>
      <TableCell>
        <div className="flex flex-col gap-1">
          <Label htmlFor={fieldProps.id} className="sr-only">
            Override for {message.key}
          </Label>
          {message.default.length > LONG_TEXT ? (
            <Textarea {...fieldProps} />
          ) : (
            <Input {...fieldProps} />
          )}
          {message.override !== null && (
            <span className="w-fit rounded bg-accent px-2 py-0.5 text-xs">changed</span>
          )}
          {error && (
            <p id={errorId} role="alert" className="text-destructive text-xs">
              {error}
            </p>
          )}
        </div>
      </TableCell>
      <TableCell>
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
      </TableCell>
    </TableRow>
  )
}
