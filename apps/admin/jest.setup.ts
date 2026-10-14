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
