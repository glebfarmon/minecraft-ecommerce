import '@testing-library/jest-dom'

// jsdom has no PointerEvent; Testing Library falls back to a plain Event and drops `pointerType`.
if (typeof window !== 'undefined' && typeof window.PointerEvent === 'undefined') {
  class PointerEvent extends MouseEvent {
    readonly pointerType: string
    constructor(type: string, init: PointerEventInit = {}) {
      super(type, init)
      this.pointerType = init.pointerType ?? ''
    }
  }
  window.PointerEvent = PointerEvent as typeof window.PointerEvent
}

// jsdom has no layout engine: ResizeObserver never fires and scrollIntoView does not exist.
if (typeof window !== 'undefined') {
  window.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  Element.prototype.scrollIntoView = jest.fn()
}
