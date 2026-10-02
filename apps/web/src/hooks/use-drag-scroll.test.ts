import {renderHook} from '@testing-library/react'

import {useDragScroll} from './use-drag-scroll'

const MAX_SCROLL = 300

function setup() {
  const el = document.createElement('div')
  let scrollLeft = 100
  Object.defineProperty(el, 'scrollLeft', {
    get: () => scrollLeft,
    set: (v: number) => {
      scrollLeft = Math.min(Math.max(v, 0), MAX_SCROLL)
    },
    configurable: true
  })
  const child = document.createElement('button')
  const onClick = jest.fn()
  child.addEventListener('click', onClick)
  el.appendChild(child)
  document.body.appendChild(el)
  const {unmount} = renderHook(() => {
    useDragScroll({current: el})
  })
  const fire = (type: string, x: number, pointerType = 'mouse', target: Element = el) => {
    target.dispatchEvent(
      new PointerEvent(type, {clientX: x, pointerType, pointerId: 1, button: 0, bubbles: true})
    )
  }
  return {el, child, onClick, fire, unmount, scroll: () => scrollLeft}
}

describe('useDragScroll', () => {
  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('scrolls opposite to the mouse movement', () => {
    const {fire, scroll} = setup()
    fire('pointerdown', 200)
    fire('pointermove', 150)
    expect(scroll()).toBe(150)
  })

  it('ignores movement below the click threshold', () => {
    const {fire, scroll} = setup()
    fire('pointerdown', 200)
    fire('pointermove', 198)
    expect(scroll()).toBe(100)
  })

  it('leaves touch to native scrolling', () => {
    const {fire, scroll} = setup()
    fire('pointerdown', 200, 'touch')
    fire('pointermove', 100, 'touch')
    expect(scroll()).toBe(100)
  })

  it('stops following the mouse after release', () => {
    const {fire, scroll} = setup()
    fire('pointerdown', 200)
    fire('pointermove', 150)
    fire('pointerup', 150)
    fire('pointermove', 50)
    expect(scroll()).toBe(150)
  })

  it('swallows the click that ends a drag', () => {
    const {fire, child, onClick} = setup()
    fire('pointerdown', 200, 'mouse', child)
    fire('pointermove', 150)
    fire('pointerup', 150)
    child.click()
    expect(onClick).not.toHaveBeenCalled()
  })

  it('keeps a plain click working', () => {
    const {fire, child, onClick} = setup()
    fire('pointerdown', 200, 'mouse', child)
    fire('pointerup', 200)
    child.click()
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('does not swallow the click after the next press', () => {
    const {fire, child, onClick} = setup()
    fire('pointerdown', 200)
    fire('pointermove', 150)
    fire('pointerup', 150)
    fire('pointerdown', 200, 'mouse', child)
    fire('pointerup', 200)
    child.click()
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('removes its listeners on unmount', () => {
    const {fire, unmount, scroll} = setup()
    unmount()
    fire('pointerdown', 200)
    fire('pointermove', 150)
    expect(scroll()).toBe(100)
  })
})

describe('useDragScroll momentum', () => {
  beforeEach(() => {
    jest.useFakeTimers()
  })
  afterEach(() => {
    jest.useRealTimers()
    document.body.innerHTML = ''
  })

  // Mouse moves left 20px every 16ms (a flick), then releases.
  function flick(t: ReturnType<typeof setup>) {
    t.fire('pointerdown', 250)
    for (const x of [230, 210, 190]) {
      jest.advanceTimersByTime(16)
      t.fire('pointermove', x)
    }
    t.fire('pointerup', 190)
  }

  it('keeps scrolling after a fast release', () => {
    const t = setup()
    flick(t)
    const atRelease = t.scroll()
    jest.advanceTimersByTime(300)
    expect(t.scroll()).toBeGreaterThan(atRelease)
  })

  it('does not coast after releasing a held, slow drag', () => {
    const t = setup()
    t.fire('pointerdown', 250)
    jest.advanceTimersByTime(16)
    t.fire('pointermove', 190)
    jest.advanceTimersByTime(400) // held still before letting go
    t.fire('pointerup', 190)
    const atRelease = t.scroll()
    jest.advanceTimersByTime(500)
    expect(t.scroll()).toBe(atRelease)
  })

  it('slows to a stop and schedules no more frames', () => {
    const t = setup()
    flick(t)
    jest.advanceTimersByTime(5000)
    const settled = t.scroll()
    jest.advanceTimersByTime(1000)
    expect(t.scroll()).toBe(settled)
    expect(jest.getTimerCount()).toBe(0)
  })

  it('stops at the end of the scroll range', () => {
    const t = setup()
    flick(t)
    jest.advanceTimersByTime(5000)
    expect(t.scroll()).toBeLessThanOrEqual(MAX_SCROLL)
    expect(jest.getTimerCount()).toBe(0)
  })

  it('stops when the mouse is pressed again', () => {
    const t = setup()
    flick(t)
    jest.advanceTimersByTime(48)
    t.fire('pointerdown', 100)
    const atPress = t.scroll()
    jest.advanceTimersByTime(500)
    expect(t.scroll()).toBe(atPress)
  })

  it('cancels the animation on unmount', () => {
    const t = setup()
    flick(t)
    jest.advanceTimersByTime(32)
    t.unmount()
    const atUnmount = t.scroll()
    jest.advanceTimersByTime(500)
    expect(t.scroll()).toBe(atUnmount)
  })
})
