import {render, screen} from '@testing-library/react'

import {Button} from '@shop/ui/button'

describe('primitives', () => {
  it('Button has accent, ghost, danger and icon styles and a focus ring', () => {
    render(
      <>
        <Button>Save</Button>
        <Button variant="ghost">Cancel</Button>
        <Button variant="danger">Delete</Button>
        <Button size="icon" aria-label="More">
          ⋯
        </Button>
      </>
    )
    expect(screen.getByRole('button', {name: 'Save'}).className).toMatch(/bg-accent/)
    expect(screen.getByRole('button', {name: 'Cancel'}).className).toMatch(/hover:bg-card-raised/)
    expect(screen.getByRole('button', {name: 'Delete'}).className).toMatch(/text-bad/)
    expect(screen.getByRole('button', {name: 'More'}).className).toMatch(/size-9/)
    expect(screen.getByRole('button', {name: 'Save'}).className).toMatch(/focus-visible:ring-2/)
  })
})
