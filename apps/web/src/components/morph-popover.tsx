'use client'

import {MORPH} from '@/config/motion'
import {useDismiss} from '@/hooks/use-dismiss'
import {X} from 'lucide-react'
import {AnimatePresence, MotionConfig, motion} from 'motion/react'
import type {ReactNode} from 'react'
import {useEffect, useId, useRef, useState} from 'react'

// Trigger and panel share one radius (half of the 44px trigger), so Motion never has to morph corners.
const RADIUS = 22

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
  /** Controlled mode: the owner decides when the popover is open. Leave both out for the usual self-contained popover. */
  open?: boolean
  onOpenChange?: (open: boolean) => void
  /** Share the container-transform id with a surface the popover hands over to (see `handoff`). */
  layoutId?: string
  /**
   * Another surface (a modal) has taken over the `layoutId` and the panel is gone, but the popover
   * still counts as open: its trigger stays a ghost so the id does not bounce back to it, and
   * dismissal belongs to the surface on top.
   */
  handoff?: boolean
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
  open: controlledOpen,
  onOpenChange,
  layoutId,
  handoff = false,
  children
}: Props) {
  const [ownOpen, setOwnOpen] = useState(false)
  const open = controlledOpen ?? ownOpen
  const setOpen = (next: boolean) => {
    if (controlledOpen === undefined) setOwnOpen(next)
    onOpenChange?.(next)
  }
  // Trigger content fades in only when it returns from the panel, not on first paint.
  const [everOpened, setEverOpened] = useState(false)
  // While the panel grows it sweeps under a still cursor; the browser then keeps :hover on whatever passed by until the mouse moves.
  const [settled, setSettled] = useState(false)
  const ownId = useId()
  const id = layoutId ?? ownId
  const root = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const wasOpen = useRef(false)
  const close = () => {
    setOpen(false)
  }
  useDismiss(root, open && !handoff, close)

  const panelShown = open && !handoff
  useEffect(() => {
    if (panelShown) panelRef.current?.focus()
    else if (!open && wasOpen.current) triggerRef.current?.focus()
    wasOpen.current = open
  }, [open, panelShown])

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
          {panelShown && (
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
                // Also fires when the panel returns from a handoff, where the click handler never ran.
                onAnimationStart={() => {
                  setSettled(false)
                }}
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
