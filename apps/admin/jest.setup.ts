import '@testing-library/jest-dom'

// Tests stub the network with jest.spyOn(global, 'fetch'); never leak a stub into the next test.
afterEach(() => {
  jest.restoreAllMocks()
})

// Radix Checkbox measures itself with ResizeObserver, which jsdom lacks.
globalThis.ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
}

// Radix Select uses pointer capture and scrolls the chosen option into view; jsdom has neither.
// Suites that run in the node environment have no Element.
if (typeof Element !== 'undefined') {
  Element.prototype.hasPointerCapture = () => false
  Element.prototype.releasePointerCapture = () => undefined
  Element.prototype.scrollIntoView = () => undefined
}

// ProseMirror (the rich text field) measures ranges and hit-tests points; jsdom does neither.
if (typeof Range !== 'undefined') {
  const rect = {x: 0, y: 0, width: 0, height: 0, top: 0, left: 0, right: 0, bottom: 0, toJSON() {}}
  Range.prototype.getClientRects = () => ({
    length: 0,
    item: () => null,
    [Symbol.iterator]: [][Symbol.iterator]
  })
  Range.prototype.getBoundingClientRect = () => rect
  document.elementFromPoint = () => null
}
