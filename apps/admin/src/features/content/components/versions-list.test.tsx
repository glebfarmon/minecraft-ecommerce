import {renderWithStore} from '@/test/render-with-store'
import {fireEvent, screen, waitFor, within} from '@testing-library/react'

import {RulesEditor} from './rules-editor'
import {VersionsList} from './versions-list'

const draft = {
  content: {
    sections: [
      {id: 'general', title: {en: 'General'}, items: [{id: 'general-1', text: {en: 'Be kind.'}}]}
    ]
  },
  revision: 4,
  updatedAt: '2026-10-15T10:00:00.000Z',
  updatedBy: 'Gleb'
}
const restored = {
  ...draft,
  content: {
    sections: [
      {id: 'old', title: {en: 'Old rules'}, items: [{id: 'old-1', text: {en: 'Be polite.'}}]}
    ]
  },
  revision: 9
}
const firstPage = {
  versions: [
    // 23:30 UTC is already the next day in Warsaw.
    {id: 3, publishedAt: '2026-10-15T23:30:00.000Z', publishedBy: 'Gleb'},
    {id: 2, publishedAt: '2026-10-01T09:00:00.000Z', publishedBy: 'Gleb'}
  ],
  nextCursor: 2
}
const secondPage = {
  versions: [{id: 1, publishedAt: '2026-09-01T09:00:00.000Z', publishedBy: 'Ola'}],
  nextCursor: null
}

type Call = {method: string; path: string; search: string; body: unknown}

function mockApi() {
  const calls: Call[] = []
  jest.spyOn(global, 'fetch').mockImplementation(async (input, init) => {
    const req = input instanceof Request ? input : new Request(String(input), init)
    const url = new URL(req.url)
    const call = {
      method: req.method,
      path: url.pathname,
      search: url.search,
      body: req.method === 'GET' ? null : await req.json().catch(() => null)
    }
    calls.push(call)
    if (url.pathname.endsWith('/restore')) return Response.json(restored, {status: 201})
    if (url.pathname.endsWith('/versions'))
      return Response.json(url.searchParams.get('cursor') === '2' ? secondPage : firstPage)
    if (req.method === 'PUT') return Response.json({...restored, revision: 10})
    return Response.json(draft)
  })
  return calls
}

afterEach(() => {
  jest.restoreAllMocks()
})

describe('VersionsList', () => {
  it('loads the next page with the cursor and restores a version after confirming', async () => {
    const calls = mockApi()
    renderWithStore(
      <>
        <RulesEditor />
        <VersionsList />
      </>
    )
    const list = await screen.findByRole('list', {name: 'Published editions'})
    expect(await within(list).findByText('October 16, 2026')).toBeInTheDocument()
    expect(within(list).getByText('October 1, 2026')).toBeInTheDocument()
    expect(within(list).getAllByText('by Gleb')).toHaveLength(2)

    fireEvent.click(screen.getByRole('button', {name: 'Load more'}))
    expect(await within(list).findByText('September 1, 2026')).toBeInTheDocument()
    expect(within(list).getByText('by Ola')).toBeInTheDocument()
    expect(
      calls.some(c => c.path === '/api/admin/content/rules/versions' && c.search === '?cursor=2')
    ).toBe(true)
    // The last page has no next cursor.
    expect(screen.queryByRole('button', {name: 'Load more'})).not.toBeInTheDocument()
    // Newest first.
    expect(
      within(list)
        .getAllByRole('listitem')
        .map(li => li.textContent)
    ).toEqual([
      expect.stringContaining('October 16, 2026'),
      expect.stringContaining('October 1, 2026'),
      expect.stringContaining('September 1, 2026')
    ])

    expect(await screen.findByLabelText('Rule 1.1 (EN)')).toHaveValue('Be kind.')
    const restoreButtons = within(list).getAllByRole('button', {name: 'Restore to draft'})
    fireEvent.click(restoreButtons[2] as HTMLElement)
    expect(calls.some(c => c.path.endsWith('/restore'))).toBe(false)
    fireEvent.click(within(list).getByRole('button', {name: 'Restore'}))
    await waitFor(() => {
      expect(screen.getByLabelText('Rule 1.1 (EN)')).toHaveValue('Be polite.')
    })
    expect(calls.filter(c => c.method === 'POST')).toEqual([
      {method: 'POST', path: '/api/admin/content/rules/versions/1/restore', search: '', body: null}
    ])
    expect(screen.getByLabelText('Section 1 title (EN)')).toHaveValue('Old rules')
    expect(
      screen.getByText('Restored to the draft above. Publish it to show it on the site.')
    ).toBeInTheDocument()

    // The restored draft's revision replaces the loaded one.
    fireEvent.click(screen.getByRole('button', {name: 'Save draft'}))
    await waitFor(() => {
      expect(calls.filter(c => c.method === 'PUT')).toHaveLength(1)
    })
    expect(calls.find(c => c.method === 'PUT')?.body).toMatchObject({revision: 9})
  })
})
