import {EASE} from '@/config/motion'

/** Entrance used by the hero and the rules page: fade in while rising 12px, after `delay` seconds. */
export const rise = (delay: number) => ({
  initial: {opacity: 0, y: 12},
  animate: {opacity: 1, y: 0},
  transition: {duration: 0.6, ease: EASE, delay}
})
