import {render, screen} from '@testing-library/react'

import {SortableList} from './sortable-list'

describe('SortableList', () => {
  it('renders a labelled list with a keyboard-focusable handle per item', () => {
    render(
      <SortableList
        label="Servers"
        items={[
          {id: 'a', name: 'Alpha'},
          {id: 'b', name: 'Beta'}
        ]}
        onMove={jest.fn()}>
        {(item, handle) => (
          <>
            <button type="button" aria-label={`Move ${item.name}`} {...handle}>
              ⠿
            </button>
            {item.name}
          </>
        )}
      </SortableList>
    )
    expect(screen.getByRole('list', {name: 'Servers'})).toBeInTheDocument()
    const handle = screen.getByRole('button', {name: 'Move Alpha'})
    expect(handle).toHaveAttribute('aria-roledescription', 'sortable')
    expect(handle).toHaveAttribute('tabindex', '0')
  })

  it('has no handles to drag when disabled', () => {
    render(
      <SortableList label="Servers" disabled items={[{id: 'a'}]} onMove={jest.fn()}>
        {(item, handle) => <button type="button" aria-label={`Move ${item.id}`} {...handle} />}
      </SortableList>
    )
    expect(screen.getByRole('button', {name: 'Move a'})).toHaveAttribute('aria-disabled', 'true')
  })
})
