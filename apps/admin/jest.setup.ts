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
