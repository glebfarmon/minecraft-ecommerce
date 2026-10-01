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
