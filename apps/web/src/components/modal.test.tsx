import {fireEvent, render, screen, waitFor} from '@testing-library/react'
import {MotionGlobalConfig} from 'motion/react'
import {useState} from 'react'

import {Modal} from './modal'

beforeAll(() => {
  MotionGlobalConfig.skipAnimations = true
})
afterAll(() => {
  MotionGlobalConfig.skipAnimations = false
})

const cancel = (el: HTMLElement) => fireEvent(el, new Event('cancel', {cancelable: true}))

function Basic({onClose = jest.fn(), open = true}: {onClose?: () => void; open?: boolean}) {
  return (
    <Modal open={open} onClose={onClose} closeLabel="Close" label="Outer">
      <button type="button">inside</button>
    </Modal>
  )
}

describe('Modal onClosed', () => {
  it('fires once, after the exit animation, never while open', async () => {
    const onClosed = jest.fn()
    const ui = (open: boolean) => (
      <Modal open={open} onClose={jest.fn()} onClosed={onClosed} closeLabel="Close" label="Outer">
        <button type="button">inside</button>
      </Modal>
    )
    const {rerender} = render(ui(true))
    expect(onClosed).not.toHaveBeenCalled()
    rerender(ui(false))
    await waitFor(() => {
      expect(onClosed).toHaveBeenCalledTimes(1)
    })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})

describe('Modal with a layoutId', () => {
  it('opens and closes like any modal, so a container transform needs no special handling by callers', async () => {
    const onClose = jest.fn()
    const {rerender} = render(
      <Modal open onClose={onClose} closeLabel="Close" label="Morphing" layoutId="cart">
        <button type="button">inside</button>
      </Modal>
    )
    expect(screen.getByRole('dialog', {name: 'Morphing'})).toBeInTheDocument()
    fireEvent.click(screen.getByTestId('modal-backdrop'))
    expect(onClose).toHaveBeenCalledTimes(1)
    rerender(
      <Modal open={false} onClose={onClose} closeLabel="Close" label="Morphing" layoutId="cart">
        <button type="button">inside</button>
      </Modal>
    )
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })
  })
})

describe('Modal', () => {
  it('renders an open dialog only while open', async () => {
    const {rerender} = render(<Basic open={false} />)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    rerender(<Basic open />)
    expect(screen.getByRole('dialog', {name: 'Outer'})).toBeInTheDocument()
    rerender(<Basic open={false} />)
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })
  })

  it('inserts the dialog node on open and removes it after the exit, never keeping it hidden in the DOM', async () => {
    const {container, rerender} = render(<Basic open={false} />)
    expect(document.body.querySelector('dialog')).toBeNull()
    rerender(<Basic open />)
    expect(container.querySelector('dialog')).not.toBeNull()
    rerender(<Basic open={false} />)
    await waitFor(() => {
      expect(document.body.querySelector('dialog')).toBeNull()
    })
  })

  it('asks to close on Escape, backdrop click and the X button, but not on inner clicks', () => {
    const onClose = jest.fn()
    render(<Basic onClose={onClose} />)
    cancel(screen.getByRole('dialog'))
    expect(onClose).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByTestId('modal-backdrop'))
    expect(onClose).toHaveBeenCalledTimes(2)
    fireEvent.click(screen.getByRole('button', {name: 'Close'}))
    expect(onClose).toHaveBeenCalledTimes(3)
    fireEvent.click(screen.getByRole('button', {name: 'inside'}))
    expect(onClose).toHaveBeenCalledTimes(3)
  })

  it('closes on a click in the empty space beside the panel, not on the panel itself', () => {
    const onClose = jest.fn()
    render(<Basic onClose={onClose} />)
    fireEvent.click(screen.getByTestId('modal-layer'))
    expect(onClose).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByRole('button', {name: 'inside'}))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('never closes itself: the dialog stays until the parent flips `open`', () => {
    render(<Basic />)
    cancel(screen.getByRole('dialog'))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('returns focus to the opener after closing', async () => {
    function Host() {
      const [open, setOpen] = useState(false)
      return (
        <>
          <button
            type="button"
            onClick={() => {
              setOpen(true)
            }}>
            opener
          </button>
          <Modal
            open={open}
            onClose={() => {
              setOpen(false)
            }}
            closeLabel="Close"
            label="M">
            body
          </Modal>
        </>
      )
    }
    render(<Host />)
    const opener = screen.getByRole('button', {name: 'opener'})
    opener.focus()
    fireEvent.click(opener)
    fireEvent.click(await screen.findByRole('button', {name: 'Close'}))
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })
    expect(opener).toHaveFocus()
  })

  it('survives close then reopen mid-exit with exactly one dialog', async () => {
    const {rerender} = render(<Basic open />)
    rerender(<Basic open={false} />)
    rerender(<Basic open />)
    await waitFor(() => {
      expect(screen.getAllByRole('dialog')).toHaveLength(1)
    })
  })

  it('locks page scroll while open and releases it after the exit', async () => {
    const {rerender} = render(<Basic open />)
    expect(document.documentElement.style.overflow).toBe('hidden')
    rerender(<Basic open={false} />)
    await waitFor(() => {
      expect(document.documentElement.style.overflow).toBe('')
    })
  })
})

describe('Modal stacking', () => {
  function Stack({
    outerClose,
    innerClose,
    innerOpen = true
  }: {
    outerClose: () => void
    innerClose: () => void
    innerOpen?: boolean
  }) {
    return (
      <Modal open onClose={outerClose} closeLabel="Close outer" label="Outer">
        <p>outer body</p>
        <Modal open={innerOpen} onClose={innerClose} closeLabel="Close inner" label="Inner">
          <p>inner body</p>
        </Modal>
      </Modal>
    )
  }

  it('Escape closes only the top modal', () => {
    const outer = jest.fn()
    const inner = jest.fn()
    render(<Stack outerClose={outer} innerClose={inner} />)
    cancel(screen.getByRole('dialog', {name: 'Inner'}))
    expect(inner).toHaveBeenCalledTimes(1)
    expect(outer).not.toHaveBeenCalled()
  })

  it('a backdrop click closes only its own modal', () => {
    const outer = jest.fn()
    const inner = jest.fn()
    render(<Stack outerClose={outer} innerClose={inner} />)
    const [outerBackdrop, innerBackdrop] = screen.getAllByTestId('modal-backdrop')
    fireEvent.click(innerBackdrop as HTMLElement)
    expect(inner).toHaveBeenCalledTimes(1)
    expect(outer).not.toHaveBeenCalled()
    fireEvent.click(outerBackdrop as HTMLElement)
    expect(outer).toHaveBeenCalledTimes(1)
  })

  it('closing the inner modal leaves the outer one open and uncovered', async () => {
    const {rerender} = render(<Stack outerClose={jest.fn()} innerClose={jest.fn()} />)
    const outerPanel = () =>
      screen.getByRole('dialog', {name: 'Outer'}).querySelector('[data-covered]')
    expect(outerPanel()).toHaveAttribute('data-covered', 'true')
    rerender(<Stack outerClose={jest.fn()} innerClose={jest.fn()} innerOpen={false} />)
    await waitFor(() => {
      expect(screen.queryByRole('dialog', {name: 'Inner'})).not.toBeInTheDocument()
    })
    expect(screen.getByRole('dialog', {name: 'Outer'})).toBeInTheDocument()
    await waitFor(() => {
      expect(outerPanel()).toHaveAttribute('data-covered', 'false')
    })
  })

  it('keeps the page locked until the outer modal closes too', async () => {
    const {rerender} = render(<Stack outerClose={jest.fn()} innerClose={jest.fn()} />)
    rerender(<Stack outerClose={jest.fn()} innerClose={jest.fn()} innerOpen={false} />)
    await waitFor(() => {
      expect(screen.queryByRole('dialog', {name: 'Inner'})).not.toBeInTheDocument()
    })
    expect(document.documentElement.style.overflow).toBe('hidden')
  })
})
