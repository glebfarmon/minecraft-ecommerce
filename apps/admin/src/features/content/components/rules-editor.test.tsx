import {renderWithStore} from '@/test/render-with-store'
import {fireEvent, screen, waitFor, within} from '@testing-library/react'

import {RulesEditor} from './rules-editor'

const draft = {
  content: {
    sections: [
      {
        id: 'general',
        title: {en: 'General', pl: 'Ogólne'},
        items: [
          {id: 'general-1', text: {en: 'Be kind.', pl: 'Bądź miły.'}},
          {id: 'general-2', text: {en: 'No cheating.'}}
        ]
      }
    ]
  },
  revision: 4,
  updatedAt: '2026-10-15T10:00:00.000Z',
  updatedBy: 'Gleb'
}

type Sent = {method: string; path: string; body: unknown}

function mockApi(write: (req: Sent) => Response = () => Response.json(draft)) {
  const sent: Sent[] = []
  jest.spyOn(global, 'fetch').mockImplementation(async (input, init) => {
    const req = input instanceof Request ? input : new Request(String(input), init)
    const path = new URL(req.url).pathname
    if (req.method === 'GET') return Response.json(draft)
    const call = {method: req.method, path, body: await req.json().catch(() => null)}
    sent.push(call)
    return write(call)
  })
  return sent
}

const saveBody = (s: Sent) => s.body as {content: typeof draft.content; revision: number}

afterEach(() => {
  jest.restoreAllMocks()
})

describe('RulesEditor', () => {
  it('saves the draft with the loaded revision and keeps it after a 409 (two saves send revision 4)', async () => {
    const sent = mockApi(() => Response.json({statusCode: 409, message: 'stale'}, {status: 409}))
    renderWithStore(<RulesEditor />)
    fireEvent.change(await screen.findByLabelText('Rule 1.1 (EN)'), {
      target: {value: 'Be very kind.'}
    })
    fireEvent.click(screen.getByRole('button', {name: 'Save draft'}))
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Someone else changed the draft. Reload to see their version.'
    )
    // The admin's text stays in the form after the refusal.
    expect(screen.getByLabelText('Rule 1.1 (EN)')).toHaveValue('Be very kind.')
    fireEvent.click(screen.getByRole('button', {name: 'Save draft'}))
    await waitFor(() => {
      expect(sent).toHaveLength(2)
    })
    for (const s of sent) {
      expect(s).toMatchObject({method: 'PUT', path: '/api/admin/content/rules/draft'})
      expect(saveBody(s).revision).toBe(4)
      expect(saveBody(s).content.sections[0]?.items[0]?.text.en).toBe('Be very kind.')
    }
  })

  it('refuses an unsafe link client-side and shows it at the field', async () => {
    const sent = mockApi()
    renderWithStore(<RulesEditor />)
    const field = await screen.findByLabelText('Rule 1.2 (EN)')
    fireEvent.change(field, {target: {value: 'See [x](javascript:alert(1))'}})
    fireEvent.click(screen.getByRole('button', {name: 'Save draft'}))
    await waitFor(() => {
      expect(screen.getByLabelText('Rule 1.2 (EN)')).toHaveAttribute('aria-invalid', 'true')
    })
    expect(screen.getByLabelText('Rule 1.2 (EN)')).toHaveAccessibleDescription(
      'Links must start with https:// or /'
    )
    expect(sent).toHaveLength(0)
  })

  it('adding a section and a rule gives unique ids', async () => {
    const sent = mockApi(({body}) => Response.json({...draft, ...(body as object), revision: 5}))
    renderWithStore(<RulesEditor />)
    await screen.findByLabelText('Rule 1.1 (EN)')
    fireEvent.click(screen.getByRole('button', {name: 'Add section'}))
    fireEvent.change(screen.getByLabelText('Section 2 title (EN)'), {
      target: {value: 'General'}
    })
    expect(within(screen.getByRole('list', {name: 'Sections'})).getAllByRole('list')).toHaveLength(
      2
    )
    const [, second] = screen.getAllByRole('button', {name: 'Add rule'})
    fireEvent.click(second as HTMLElement)
    expect(screen.getByRole('button', {name: 'Move rule 2.1'})).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Rule 2.1 (EN)'), {target: {value: 'Have fun.'}})
    const [first] = screen.getAllByRole('button', {name: 'Add rule'})
    fireEvent.click(first as HTMLElement)
    fireEvent.change(screen.getByLabelText('Rule 1.3 (EN)'), {target: {value: 'Be fair.'}})
    fireEvent.click(screen.getByRole('button', {name: 'Save draft'}))
    await waitFor(() => {
      expect(sent).toHaveLength(1)
    })
    const sections = saveBody(sent[0] as Sent).content.sections
    expect(sections.map(s => s.id)).toEqual(['general', 'general-3'])
    expect(sections[0]?.items.map(i => i.id)).toEqual(['general-1', 'general-2', 'general-4'])
    expect(sections[1]?.items.map(i => i.id)).toEqual(['general-3-1'])
    const ids = sections.flatMap(s => [s.id, ...s.items.map(i => i.id)])
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('publish is disabled while there are unsaved changes', async () => {
    mockApi(({path, body}) =>
      path.endsWith('/publish')
        ? Response.json({id: 7, publishedAt: '2026-10-16T08:00:00.000Z'}, {status: 201})
        : Response.json({...draft, ...(body as object), revision: 5})
    )
    renderWithStore(<RulesEditor />)
    await screen.findByLabelText('Rule 1.1 (EN)')
    expect(screen.getByRole('button', {name: 'Publish'})).toBeEnabled()
    fireEvent.change(screen.getByLabelText('Rule 1.1 (EN)'), {target: {value: 'Be nice.'}})
    await waitFor(() => {
      expect(screen.getByRole('button', {name: 'Publish'})).toBeDisabled()
    })
    fireEvent.click(screen.getByRole('button', {name: 'Save draft'}))
    await waitFor(() => {
      expect(screen.getByRole('button', {name: 'Publish'})).toBeEnabled()
    })
  })

  it('publishes after confirming the edition date', async () => {
    const sent = mockApi(() =>
      Response.json({id: 7, publishedAt: '2026-10-16T08:00:00.000Z'}, {status: 201})
    )
    renderWithStore(<RulesEditor />)
    await screen.findByLabelText('Rule 1.1 (EN)')
    fireEvent.click(screen.getByRole('button', {name: 'Publish'}))
    const today = new Intl.DateTimeFormat('en', {
      dateStyle: 'long',
      timeZone: 'Europe/Warsaw'
    }).format(new Date())
    expect(screen.getByText(`Publish as the edition of ${today}?`)).toBeInTheDocument()
    expect(sent).toHaveLength(0)
    fireEvent.click(screen.getByRole('button', {name: 'Publish now'}))
    // dnd-kit adds its own live regions, so find our status by its text.
    expect(
      await screen.findByText('Published. Visible on the site within about a minute.')
    ).toHaveAttribute('role', 'status')
    expect(sent).toEqual([{method: 'POST', path: '/api/admin/content/rules/publish', body: null}])
  })

  it('opens the PL tab when the first error is there and hints at the EN fallback', async () => {
    const sent = mockApi()
    renderWithStore(<RulesEditor />)
    await screen.findByLabelText('Rule 1.1 (EN)')
    const language = screen.getByRole('tablist', {name: 'Language'})
    fireEvent.mouseDown(within(language).getByRole('tab', {name: 'PL'}), {button: 0})
    // Rule 1.2 has no Polish text: the site shows the English one.
    const pl = await screen.findByLabelText('Rule 1.2 (PL)')
    expect(pl).toHaveAccessibleDescription('Uses the English text')
    fireEvent.change(pl, {target: {value: '[x](//evil.example)'}})
    fireEvent.mouseDown(within(language).getByRole('tab', {name: 'EN'}), {button: 0})
    fireEvent.click(screen.getByRole('button', {name: 'Save draft'}))
    await waitFor(() => {
      expect(within(language).getByRole('tab', {name: 'PL'})).toHaveAttribute(
        'aria-selected',
        'true'
      )
    })
    expect(await screen.findByLabelText('Rule 1.2 (PL)')).toHaveAttribute('aria-invalid', 'true')
    expect(sent).toHaveLength(0)
  })
})
