import {fireEvent, render, screen, waitFor} from '@testing-library/react'

import {MorphPopover} from './morph-popover'

// jsdom has no layout, so Motion's shared-layout exit never finishes and the panel would stay mounted.
// Unmounting at once tests the open/close logic; e2e/tests/morph-popover.spec.ts covers the real exit.
jest.mock('motion/react', () => ({
  ...jest.requireActual<object>('motion/react'),
  AnimatePresence: ({children}: {children: React.ReactNode}) => children
}))

function Demo({name = 'Open settings'}: {name?: string}) {
  return (
    <MorphPopover
      triggerLabel={name}
      panelLabel={`${name} panel`}
      closeLabel="Close"
      trigger={<span>Open</span>}
      triggerClassName="h-11 px-4"
      panelClassName="w-64">
      {close => (
        <button type="button" onClick={close}>
          Done
        </button>
      )}
    </MorphPopover>
  )
}

const trigger = (name = 'Open settings') => screen.getByRole('button', {name})
const panel = (name = 'Open settings panel') => screen.getByRole('dialog', {name})
const gone = async (name = 'Open settings panel') => {
  await waitFor(() => {
    expect(screen.queryByRole('dialog', {name})).toBeNull()
  })
}

describe('MorphPopover', () => {
  it('starts collapsed: a trigger and no panel', () => {
    render(<Demo />)
    expect(trigger()).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('opens the panel on click and swaps the trigger out', () => {
    render(<Demo />)
    fireEvent.click(trigger())
    expect(panel()).toBeInTheDocument()
    // The ghost that holds the trigger's space is hidden from assistive tech.
    expect(screen.queryByRole('button', {name: 'Open settings'})).toBeNull()
  })

  it('moves focus into the panel when it opens', () => {
    render(<Demo />)
    fireEvent.click(trigger())
    expect(panel()).toHaveFocus()
  })

  it('closes on Escape and gives focus back to the trigger', async () => {
    render(<Demo />)
    fireEvent.click(trigger())
    fireEvent.keyDown(document, {key: 'Escape'})
    await gone()
    await waitFor(() => {
      expect(trigger()).toHaveFocus()
    })
  })

  it('closes on a pointer-down outside', async () => {
    render(<Demo />)
    fireEvent.click(trigger())
    fireEvent.pointerDown(document.body)
    await gone()
  })

  it('stays open on a pointer-down inside the panel', () => {
    render(<Demo />)
    fireEvent.click(trigger())
    fireEvent.pointerDown(panel())
    expect(panel()).toBeInTheDocument()
  })

  it('closes from the X button', async () => {
    render(<Demo />)
    fireEvent.click(trigger())
    fireEvent.click(screen.getByRole('button', {name: 'Close'}))
    await gone()
  })

  it('hands children a close function', async () => {
    render(<Demo />)
    fireEvent.click(trigger())
    fireEvent.click(screen.getByRole('button', {name: 'Done'}))
    await gone()
  })

  // The navbar mounts the settings menu twice (desktop bar and mobile overlay).
  it('keeps separate instances independent', () => {
    render(
      <>
        <Demo name="First" />
        <Demo name="Second" />
      </>
    )
    fireEvent.click(trigger('First'))
    expect(panel('First panel')).toBeInTheDocument()
    expect(screen.queryByRole('dialog', {name: 'Second panel'})).toBeNull()
    expect(trigger('Second')).toBeInTheDocument()
  })
})
