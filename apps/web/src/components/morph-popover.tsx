'use client'

import {useDismiss} from '@/hooks/use-dismiss'
import {X} from 'lucide-react'
import {AnimatePresence, MotionConfig, motion} from 'motion/react'
import type {ReactNode} from 'react'
import {useCallback, useEffect, useId, useRef, useState} from 'react'

// Trigger and panel share one radius (half of the 44px trigger), so Motion never has to morph corners.
const RADIUS = 22
const MORPH = {type: 'spring', bounce: 0.1, duration: 0.45} as const

const ANCHOR = {'top-end': 'top-0 right-0', 'bottom-end': 'right-0 bottom-0'} as const

type Props = {
  triggerLabel: string
  panelLabel: string
  closeLabel: string
  trigger: ReactNode
  triggerClassName?: string
  panelClassName?: string
  anchor?: keyof typeof ANCHOR
  /** Marks the popover as the landing spot for `flyToCart`. */
  flyTarget?: boolean
  children: (close: () => void) => ReactNode
}

/**
 * Container transform: the trigger and the panel are one `layoutId`, so Motion animates a single
 * box from the trigger's rect to the panel's rect and back. The panel is absolutely positioned, so
 * an invisible ghost of the trigger keeps its space and the surrounding layout does not move.
 */
export function MorphPopover({
  triggerLabel,
  panelLabel,
  closeLabel,
  trigger,
  triggerClassName = '',
  panelClassName = '',
  anchor = 'top-end',
  flyTarget = false,
  children
}: Props) {
  const [open, setOpen] = useState(false)
  // Trigger content fades in only when it returns from the panel, not on first paint.
  const [everOpened, setEverOpened] = useState(false)
  // While the panel grows it sweeps under a still cursor; the browser then keeps :hover on whatever passed by until the mouse moves.
  const [settled, setSettled] = useState(false)
  const id = useId()
  const root = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const wasOpen = useRef(false)
  const close = useCallback(() => {
    setOpen(false)
  }, [])
  useDismiss(root, open, close)

  useEffect(() => {
    if (open) panelRef.current?.focus()
    else if (wasOpen.current) triggerRef.current?.focus()
    wasOpen.current = open
  }, [open])

  return (
    <MotionConfig reducedMotion="user">
      <div ref={root} className="relative" data-cart-target={flyTarget ? '' : undefined}>
        {open ? (
          <div
            aria-hidden="true"
            inert
            className={`invisible inline-flex items-center justify-center ${triggerClassName}`}
            style={{borderRadius: RADIUS}}>
            <span className="inline-flex items-center gap-2">{trigger}</span>
          </div>
        ) : (
          <motion.button
            ref={triggerRef}
            type="button"
            layoutId={id}
            transition={MORPH}
            style={{borderRadius: RADIUS}}
            onClick={() => {
              setEverOpened(true)
              setSettled(false)
              setOpen(true)
            }}
            aria-haspopup="dialog"
            aria-label={triggerLabel}
            className={`inline-flex items-center justify-center transition-colors duration-300 ${triggerClassName}`}>
            <motion.span
              initial={everOpened ? {opacity: 0} : false}
              animate={{opacity: 1}}
              transition={{delay: 0.15, duration: 0.2}}
              className="inline-flex items-center gap-2">
              {trigger}
            </motion.span>
          </motion.button>
        )}

        <AnimatePresence>
          {open && (
            <motion.div
              ref={panelRef}
              role="dialog"
              aria-label={panelLabel}
              tabIndex={-1}
              layoutId={id}
              transition={MORPH}
              style={{borderRadius: RADIUS}}
              className={`absolute z-50 border border-border bg-surface shadow-[0_24px_48px_rgb(0_0_0/0.5)] transition-colors duration-300 outline-none ${ANCHOR[anchor]} ${panelClassName}`}>
              <motion.div
                initial={{opacity: 0, filter: 'blur(6px)'}}
                animate={{
                  opacity: 1,
                  filter: 'blur(0px)',
                  transition: {delay: 0.12, duration: 0.25}
                }}
                exit={{opacity: 0, filter: 'blur(6px)', transition: {duration: 0.1}}}
                onAnimationComplete={() => {
                  setSettled(true)
                }}
                className={`relative p-4 ${settled ? '' : 'pointer-events-none'}`}>
                {children(close)}
                <button
                  type="button"
                  onClick={close}
                  aria-label={closeLabel}
                  className="absolute top-3 right-3 grid size-8 place-items-center rounded-full text-muted hover:bg-white/5 hover:text-fg">
                  <X className="size-4" />
                </button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </MotionConfig>
  )
}
