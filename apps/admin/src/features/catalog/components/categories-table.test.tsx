import {renderWithStore} from '@/test/render-with-store'
import {fireEvent, screen, waitFor, within} from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import {CategoriesTable} from './categories-table'

const ranks = {
  id: 'c1',
  slug: 'ranks',
  names: {en: 'Ranks', pl: 'Rangi'},
  version: 1,
  productCount: 6,
  servers: [{id: 's1', name: 'Survival'}]
}

describe('CategoriesTable', () => {
  it('lists categories with both names, servers and product counts', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue(Response.json([ranks]))
    renderWithStore(<CategoriesTable canEdit />)
    const table = await screen.findByRole('table', {name: 'Categories'})
    const row = within(table).getByText('Rangi').closest('tr') as HTMLElement
    expect(row).toHaveTextContent('ranks')
    expect(row).toHaveTextContent('Survival')
    expect(row).toHaveTextContent('6')
  })

  it('creates a category with both names', async () => {
    const fetchMock = jest.spyOn(global, 'fetch').mockImplementation((input, init) => {
      const req = input instanceof Request ? input : new Request(String(input), init)
      return Promise.resolve(
        req.method === 'POST' ? Response.json(ranks, {status: 201}) : Response.json([])
      )
    })
    renderWithStore(<CategoriesTable canEdit />)
    fireEvent.change(await screen.findByLabelText('Slug'), {target: {value: 'tools'}})
    fireEvent.change(screen.getByLabelText('English name'), {target: {value: 'Tools'}})
    fireEvent.change(screen.getByLabelText('Polish name'), {target: {value: 'Narzędzia'}})
    fireEvent.click(screen.getByRole('button', {name: 'Add category'}))
    await waitFor(() => {
      const post = fetchMock.mock.calls.map(([r]) => r as Request).find(r => r.method === 'POST')
      expect(post).toBeDefined()
    })
  })

  it('shows a field error for a bad slug', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue(Response.json([]))
    renderWithStore(<CategoriesTable canEdit />)
    fireEvent.change(await screen.findByLabelText('Slug'), {target: {value: 'Bad Slug'}})
    fireEvent.click(screen.getByRole('button', {name: 'Add category'}))
    expect(
      await screen.findByText('Use 1–40 lowercase letters, digits or dashes')
    ).toBeInTheDocument()
  })

  it('deletes from the row menu after a confirmation', async () => {
    const methods: string[] = []
    jest.spyOn(global, 'fetch').mockImplementation((input, init) => {
      const req = input instanceof Request ? input : new Request(String(input), init)
      methods.push(req.method)
      return Promise.resolve(
        req.method === 'DELETE' ? new Response(null, {status: 204}) : Response.json([ranks])
      )
    })
    const user = userEvent.setup()
    renderWithStore(<CategoriesTable canEdit />)
    const table = await screen.findByRole('table', {name: 'Categories'})
    await user.click(within(table).getByRole('button', {name: 'Actions for Ranks'}))
    await user.click(await screen.findByRole('menuitem', {name: 'Delete'}))
    expect(methods).not.toContain('DELETE')
    await user.click(screen.getByRole('button', {name: 'Confirm delete'}))
    await waitFor(() => {
      expect(methods).toContain('DELETE')
    })
  })

  it('initialEdit opens the edit form for that category', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue(Response.json([ranks]))
    renderWithStore(<CategoriesTable canEdit initialEdit="c1" />)
    expect(await screen.findByText('Edit Ranks')).toBeInTheDocument()
  })

  it('clicking a row opens its edit form', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue(Response.json([ranks]))
    renderWithStore(<CategoriesTable canEdit />)
    const table = await screen.findByRole('table', {name: 'Categories'})
    fireEvent.click(within(table).getByText('ranks'))
    expect(await screen.findByText('Edit Ranks')).toBeInTheDocument()
  })

  it('renames from the row menu', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue(Response.json([ranks]))
    const user = userEvent.setup()
    renderWithStore(<CategoriesTable canEdit />)
    const table = await screen.findByRole('table', {name: 'Categories'})
    await user.click(within(table).getByRole('button', {name: 'Actions for Ranks'}))
    await user.click(await screen.findByRole('menuitem', {name: 'Edit'}))
    expect(screen.getByRole('group', {name: 'Edit Ranks'})).toBeInTheDocument()
    expect(screen.getByDisplayValue('Rangi')).toBeInTheDocument()
  })
})
