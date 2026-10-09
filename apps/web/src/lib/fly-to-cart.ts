import {FLY_TO_CART} from '@/config/motion'

const {
  durationMs: DURATION,
  steps: STEPS,
  crouch: CROUCH,
  swallow: SWALLOW,
  edgeMarginPx: EDGE_MARGIN,
  bumpMs
} = FLY_TO_CART
const EASE_OUT = 'cubic-bezier(0.16, 1, 0.3, 1)'

const f = (n: number) => n.toFixed(2)
const smooth = (t: number) => t * t * (3 - 2 * t)

/** Where the flight ends: the cart trigger, marked with `data-cart-target`. */
function cartTarget() {
  return document.querySelector<HTMLElement>('[data-cart-target]')
}

function bump(target: HTMLElement) {
  // Absent in jsdom and very old browsers.
  if (typeof (target as Partial<HTMLElement>).animate !== 'function') return
  target.animate(
    [
      {transform: 'scale(1)'},
      {transform: 'scale(1.22)', offset: 0.35},
      {transform: 'scale(0.94)', offset: 0.65},
      {transform: 'scale(1)'}
    ],
    {duration: bumpMs, easing: EASE_OUT}
  )
}

function frames(w: number, h: number, dx: number, dy: number, startY: number): Keyframe[] {
  const dist = Math.hypot(dx, dy)
  // The jump goes above the straight line; the further the cart, the higher the arc.
  // ...but never above the viewport: near the top edge the arc flattens to the room that is left.
  const headroom = startY + dy / 2 - EDGE_MARGIN
  const arc = Math.max(0, Math.min(180, Math.max(60, dist * 0.3), headroom))
  const endScale = Math.min(1, 28 / Math.max(w, h))
  const lean = dx === 0 ? 0 : Math.sign(dx)

  const out: Keyframe[] = [
    {
      offset: 0,
      transform: 'translate(0px, 0px) scale(1, 1)',
      clipPath: 'circle(75% at 50% 50%)',
      opacity: 1
    },
    // Crouch: squash down, widen, as if loading the jump.
    {
      offset: CROUCH,
      transform: 'translate(0px, 4px) scale(1.04, 0.93)',
      clipPath: 'circle(75% at 50% 50%)',
      opacity: 1
    }
  ]
  for (let i = 1; i <= STEPS; i++) {
    const t = i / STEPS
    const p = smooth(t)
    const x = dx * p
    const y = dy * p - arc * 4 * p * (1 - p)
    // Squeezed along the way: shrinks faster than it travels, stretches at peak speed.
    const s = 1 - (1 - endScale) * Math.pow(p, 0.75)
    const bell = Math.sin(Math.PI * p)
    const sx = s * (1 - 0.1 * bell)
    const sy = s * (1 + 0.16 * bell)
    const tilt = lean * 16 * bell
    const swallow = Math.max(0, (t - (1 - SWALLOW)) / SWALLOW)
    out.push({
      offset: CROUCH + (1 - CROUCH) * t,
      transform: `translate(${f(x)}px, ${f(y)}px) rotate(${f(tilt)}deg) scale(${f(sx)}, ${f(sy)})`,
      clipPath: `circle(${f(75 * (1 - swallow))}% at 50% 50%)`,
      opacity: Math.max(0, swallow > 0.7 ? 1 - (swallow - 0.7) / 0.3 : 1)
    })
  }
  return out
}

/**
 * Throws a copy of `source` into the cart: it crouches, jumps in an arc, shrinks on the way and
 * is swallowed by the cart trigger, which then pulses. The copy lives in `document.body`, so no
 * ancestor can clip it, and the real element never moves. Under reduced motion only the pulse runs.
 */
export function flyToCart(source: Element | null) {
  const target = cartTarget()
  if (!target) return
  if (
    !source ||
    typeof (source as HTMLElement).animate !== 'function' ||
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  ) {
    bump(target)
    return
  }

  const from = source.getBoundingClientRect()
  const to = target.getBoundingClientRect()
  if (from.width === 0 || to.width === 0) {
    bump(target)
    return
  }

  const clone = source.cloneNode(true) as HTMLElement
  clone.removeAttribute('id')
  clone.querySelectorAll('[id]').forEach(el => {
    el.removeAttribute('id')
  })
  clone.setAttribute('aria-hidden', 'true')
  clone.inert = true
  Object.assign(clone.style, {
    position: 'fixed',
    left: `${f(from.left)}px`,
    top: `${f(from.top)}px`,
    width: `${f(from.width)}px`,
    height: `${f(from.height)}px`,
    margin: '0',
    zIndex: '60',
    pointerEvents: 'none',
    transformOrigin: '50% 50%',
    willChange: 'transform, opacity, clip-path'
  })
  document.body.appendChild(clone)

  const dx = to.left + to.width / 2 - (from.left + from.width / 2)
  const dy = to.top + to.height / 2 - (from.top + from.height / 2)
  const done = () => {
    clone.remove()
    bump(target)
  }
  clone
    .animate(frames(from.width, from.height, dx, dy, from.top + from.height / 2), {
      duration: DURATION,
      fill: 'forwards'
    })
    .finished.then(done, () => {
      clone.remove()
    })
}
