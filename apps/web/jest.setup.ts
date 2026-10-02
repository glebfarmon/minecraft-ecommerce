import '@testing-library/jest-dom'

// jsdom has no PointerEvent; Testing Library falls back to a plain Event and drops `pointerType`.
if (typeof window !== 'undefined' && typeof window.PointerEvent === 'undefined') {
  class PointerEvent extends MouseEvent {
    readonly pointerType: string
    readonly pointerId: number
    constructor(type: string, init: PointerEventInit = {}) {
      super(type, init)
      this.pointerType = init.pointerType ?? ''
      this.pointerId = init.pointerId ?? 0
    }
  }
  window.PointerEvent = PointerEvent as typeof window.PointerEvent
}

// jsdom has no layout engine: ResizeObserver never fires and elements cannot scroll.
if (typeof window !== 'undefined') {
  window.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  Element.prototype.scrollBy = jest.fn()
  Element.prototype.setPointerCapture = jest.fn()
  Element.prototype.releasePointerCapture = jest.fn()
}

// jsdom does not implement modal dialogs; model just the `open` attribute and the `close` event.
if (typeof HTMLDialogElement !== 'undefined') {
  const dialog: Partial<HTMLDialogElement> = HTMLDialogElement.prototype
  if (!dialog.showModal) {
    dialog.showModal = function showModal(this: HTMLDialogElement) {
      this.setAttribute('open', '')
    }
    dialog.close = function close(this: HTMLDialogElement) {
      this.removeAttribute('open')
      this.dispatchEvent(new Event('close'))
    }
  }
}
