import {flyToCart} from '@/lib/fly-to-cart'

function must<T>(value: T | null | undefined): T {
  if (value == null) throw new Error('missing')
  return value
}

function rect(left: number, top: number, width: number, height: number): DOMRect {
  return {
    left,
    top,
    width,
    height,
    right: left + width,
    bottom: top + height,
    x: left,
    y: top,
    toJSON: () => ({})
  }
}

function setup() {
  document.body.innerHTML = `
    <div data-cart-target></div>
    <article id="card"><h3 id="title">Card</h3></article>`
  const target = must(document.querySelector<HTMLElement>('[data-cart-target]'))
  const card = must(document.querySelector<HTMLElement>('#card'))
  target.getBoundingClientRect = () => rect(900, 10, 44, 44)
  card.getBoundingClientRect = () => rect(100, 400, 300, 420)
  return {target, card}
}

function mockMotion(reduced: boolean) {
  window.matchMedia = jest.fn().mockReturnValue({matches: reduced}) as typeof window.matchMedia
  const calls: {el: Element; keyframes: Keyframe[]}[] = []
  const finish: (() => void)[] = []
  HTMLElement.prototype.animate = function (this: HTMLElement, keyframes: Keyframe[]) {
    calls.push({el: this, keyframes})
    return {
      finished: new Promise<void>(resolve => finish.push(resolve))
    } as unknown as Animation
  }
  return {calls, finish}
}

afterEach(() => {
  delete (HTMLElement.prototype as Partial<HTMLElement>).animate
})

it('flies an inert clone of the source from the card to the cart, then removes it and bumps the cart', async () => {
  const {card, target} = setup()
  const {calls, finish} = mockMotion(false)

  flyToCart(card)

  const clones = document.body.querySelectorAll('article')
  expect(clones).toHaveLength(2)
  const clone = must(clones[1])
  expect(clone).toHaveAttribute('aria-hidden', 'true')
  expect(clone.querySelector('#title')).toBeNull() // ids must not be duplicated
  expect(calls).toHaveLength(1)
  expect(must(calls[0]).el).toBe(clone)
  const frames = must(calls[0]).keyframes
  const last = must(frames[frames.length - 1])
  expect(last.opacity).toBe(0)
  // Lands on the cart centre: card centre (250, 610) → target centre (922, 32).
  expect(String(last.transform)).toContain('translate(672.00px, -578.00px)')

  must(finish[0])()
  await Promise.resolve()
  await Promise.resolve()
  expect(document.body.querySelectorAll('article')).toHaveLength(1)
  expect(must(calls[1]).el).toBe(target) // landing bump
})

it('skips the flight but still acknowledges on the cart under reduced motion', () => {
  const {card, target} = setup()
  const {calls} = mockMotion(true)

  flyToCart(card)

  expect(document.body.querySelectorAll('article')).toHaveLength(1)
  expect(calls).toHaveLength(1)
  expect(must(calls[0]).el).toBe(target)
})

it('does nothing when there is no cart target or no animation support', () => {
  setup()
  expect(() => {
    flyToCart(document.querySelector('#card'))
  }).not.toThrow()
  expect(document.body.querySelectorAll('article')).toHaveLength(1)
})

it('keeps the whole jump inside the viewport when the card starts near the top edge', () => {
  const {card} = setup()
  card.getBoundingClientRect = () => rect(100, 60, 300, 420) // centre y = 270, cart centre y = 32
  const {calls} = mockMotion(false)

  flyToCart(card)

  const ys = must(calls[0]).keyframes.map(k => {
    const match = /translate\(([-\d.]+)px, ([-\d.]+)px\)/.exec(String(k.transform))
    return 270 + Number(match?.[2])
  })
  expect(Math.min(...ys)).toBeGreaterThanOrEqual(0)
})
