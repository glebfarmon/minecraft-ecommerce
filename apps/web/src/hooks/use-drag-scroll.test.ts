import {renderHook} from '@testing-library/react'

import {useDragScroll} from './use-drag-scroll'

function setup() {
  const el = document.createElement('div')
  let scrollLeft = 100
  Object.defineProperty(el, 'scrollLeft', {
    get: () => scrollLeft,
    set: (v: number) => {
      scrollLeft = v
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
