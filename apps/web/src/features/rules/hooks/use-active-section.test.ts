import {act, renderHook} from '@testing-library/react'

import {useActiveSection} from './use-active-section'

let report: IntersectionObserverCallback = () => {}
const original = window.IntersectionObserver

beforeEach(() => {
  window.IntersectionObserver = class {
    constructor(callback: IntersectionObserverCallback) {
      report = callback
    }
    observe() {}
    unobserve() {}
    disconnect() {}
    takeRecords() {
      return []
    }
  } as unknown as typeof IntersectionObserver
  document.body.innerHTML = '<section id="s-1"></section><section id="s-2"></section>'
})

afterEach(() => {
  window.IntersectionObserver = original
  document.body.innerHTML = ''
})

const entry = (id: string, isIntersecting: boolean) =>
  ({target: document.getElementById(id), isIntersecting}) as unknown as IntersectionObserverEntry

const fire = (...entries: IntersectionObserverEntry[]) => {
  act(() => {
    report(entries, {} as IntersectionObserver)
  })
}

describe('useActiveSection', () => {
  it('starts on the first section', () => {
    const {result} = renderHook(() => useActiveSection(['s-1', 's-2']))
    expect(result.current).toBe('s-1')
  })

  it('follows the first section in the reading band', () => {
    const {result} = renderHook(() => useActiveSection(['s-1', 's-2']))
    fire(entry('s-1', false), entry('s-2', true))
    expect(result.current).toBe('s-2')
  })

  it('keeps the last section while none is in the band', () => {
    const {result} = renderHook(() => useActiveSection(['s-1', 's-2']))
    fire(entry('s-2', true))
    fire(entry('s-2', false))
    expect(result.current).toBe('s-2')
  })

  it('falls back to the first id when the active one is filtered out', () => {
    const {result, rerender} = renderHook(({ids}) => useActiveSection(ids), {
      initialProps: {ids: ['s-1', 's-2']}
    })
    fire(entry('s-2', true))
    rerender({ids: ['s-1']})
    expect(result.current).toBe('s-1')
  })
})
