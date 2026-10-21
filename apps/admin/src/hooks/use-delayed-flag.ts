import {useEffect, useRef, useState} from 'react'

/**
 * True only after `active` has held for `delay` ms; once true it stays true for at least `minVisible` ms.
 * Keeps loading placeholders from flashing on fast loads and from blinking away on slow ones.
 */
export function useDelayedFlag(
  active: boolean,
  {delay = 200, minVisible = 400}: {delay?: number; minVisible?: number} = {}
): boolean {
  const [shown, setShown] = useState(false)
  const shownAt = useRef(0)

  useEffect(() => {
    if (active && !shown) {
      const timer = setTimeout(() => {
        shownAt.current = Date.now()
        setShown(true)
      }, delay)
      return () => {
        clearTimeout(timer)
      }
    }
    if (!active && shown) {
      const timer = setTimeout(
        () => {
          setShown(false)
        },
        Math.max(0, minVisible - (Date.now() - shownAt.current))
      )
      return () => {
        clearTimeout(timer)
      }
    }
    return undefined
  }, [active, shown, delay, minVisible])

  return shown
}
