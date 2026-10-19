import {fireEvent, render, screen, within} from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import {DataTable} from './data-table'

type Row = {id: string; nick: string; email: string}
const rows: Row[] = [
  {id: '1', nick: 'Steve', email: `${'a'.repeat(240)}@example.com`},
  {id: '2', nick: 'Alex', email: 'alex@example.com'}
]

function setup(onOpen: jest.Mock<void, [string]> = jest.fn()) {
  render(
    <DataTable
      caption="Orders"
      rows={rows}
      rowKey={r => r.id}
      columns={[
        {header: 'Nick', cell: r => r.nick, primary: true},
        {header: 'Email', cell: r => r.email}
      ]}
      menu={r => [
        {
          label: 'Open',
          onSelect: () => {
            onOpen(r.id)
          }
        }
      ]}
    />
  )
  return onOpen
}

describe('DataTable', () => {
  it('renders a captioned table and a mobile list with the same rows', () => {
    setup()
    const table = screen.getByRole('table', {name: 'Orders'})
    expect(within(table).getAllByRole('row')).toHaveLength(3) // header + 2
    const list = screen.getByRole('list', {name: 'Orders'})
    expect(within(list).getAllByRole('listitem')).toHaveLength(2)
  })

  it('truncates long cells on desktop and wraps them on mobile', () => {
    setup()
    const cell = within(screen.getByRole('table')).getByText(/a{240}@example\.com/, {
      selector: 'td *, td'
    })
    expect(cell.closest('td')?.innerHTML).toMatch(/truncate/)
    const mobile = within(screen.getByRole('list', {name: 'Orders'}))
      .getAllByText(/a{240}@example\.com/)
      .at(0)
    expect(mobile?.className).toMatch(/break-all/)
  })

  it('opens the row menu from the keyboard and runs the item', async () => {
    const user = userEvent.setup()
    const onOpen = setup()
    const table = screen.getByRole('table')
    const trigger = within(table)
      .getAllByRole('button', {name: 'Actions for Steve'})
      .at(0) as HTMLElement
    trigger.focus()
    await user.keyboard('{Enter}')
    const item = await screen.findByRole('menuitem', {name: 'Open'})
    await user.keyboard('{Enter}')
    expect(onOpen).toHaveBeenCalledWith('1')
    expect(item).not.toBeInTheDocument()
  })

  it('returns focus to the trigger on Escape', async () => {
    const user = userEvent.setup()
    setup()
    const trigger = within(screen.getByRole('table'))
      .getAllByRole('button', {
        name: 'Actions for Steve'
      })
      .at(0) as HTMLElement
    trigger.focus()
    await user.keyboard('{Enter}')
    await screen.findByRole('menu')
    await user.keyboard('{Escape}')
    expect(trigger).toHaveFocus()
  })

  it('names the row menu with rowLabel when the primary cell is not a string', () => {
    render(
      <DataTable
        caption="Orders"
        rows={rows}
        rowKey={r => r.id}
        rowLabel={r => r.nick}
        columns={[{header: 'Nick', cell: r => <a href={`/${r.id}`}>{r.nick}</a>, primary: true}]}
        menu={() => [{label: 'Open', onSelect: jest.fn()}]}
      />
    )
    const table = screen.getByRole('table')
    expect(within(table).getByRole('button', {name: 'Actions for Alex'})).toBeInTheDocument()
  })

  it('leaves out the menu button for rows without actions', () => {
    render(
      <DataTable
        caption="Orders"
        rows={rows}
        rowKey={r => r.id}
        columns={[{header: 'Nick', cell: r => r.nick, primary: true}]}
        menu={r => (r.id === '1' ? [] : [{label: 'Open', onSelect: jest.fn()}])}
      />
    )
    const table = screen.getByRole('table')
    expect(within(table).queryByRole('button', {name: 'Actions for Steve'})).toBeNull()
    expect(within(table).getByRole('button', {name: 'Actions for Alex'})).toBeInTheDocument()
  })

  it('shows the empty slot when there are no rows', () => {
    render(
      <DataTable
        caption="Orders"
        rows={[]}
        rowKey={() => ''}
        columns={[]}
        empty={<p>No orders found.</p>}
      />
    )
    expect(screen.getByText('No orders found.')).toBeInTheDocument()
    fireEvent.click(document.body)
  })
})
