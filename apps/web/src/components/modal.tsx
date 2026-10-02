'use client'

import {EASE} from '@/config/motion'
import {useScrollLock} from '@/hooks/use-scroll-lock'
import {X} from 'lucide-react'
import {AnimatePresence, MotionConfig, motion, useIsPresent} from 'motion/react'
import type {CSSProperties, ReactNode} from 'react'
import {createContext, useContext, useEffect, useMemo, useRef, useState} from 'react'

const BACKDROP = {hidden: {opacity: 0}, shown: {opacity: 1}}
const PANEL = {
  hidden: {opacity: 0, y: 24, scale: 0.98},
  shown: {opacity: 1, y: 0, scale: 1}
}

type Layer = {depth: number; cover: () => () => void}
/** Set by each open modal so a modal rendered in its children knows its depth and can dim it. */
const LayerContext = createContext<Layer | null>(null)

type Props = {
  open: boolean
  onClose: () => void
  closeLabel: string
  labelledBy?: string
  label?: string
  className?: string
  style?: CSSProperties
  children: ReactNode
}

/**
 * Controlled, stackable dialog. The native `<dialog>` (opened with `showModal`) supplies the top
 * layer, focus trap and "Escape closes only the topmost". It is a transparent full-viewport shell:
 * the backdrop and panel are our own so they can animate in and out. A Modal inside another
 * Modal's children is a child layer; it lightens its backdrop and marks the parent as covered.
 */
export function Modal({open, ...props}: Props) {
  return (
    <MotionConfig reducedMotion="user">
      <AnimatePresence>{open && <ModalDialog key="dialog" {...props} />}</AnimatePresence>
    </MotionConfig>
  )
}

function ModalDialog({
  onClose,
  closeLabel,
  labelledBy,
  label,
  className = '',
  style,
  children
}: Omit<Props, 'open'>) {
  const parent = useContext(LayerContext)
  const depth = parent ? parent.depth + 1 : 0
  const [covers, setCovers] = useState(0)
  const dialog = useRef<HTMLDialogElement>(null)
  const present = useIsPresent()
  useScrollLock(true)

  const layer = useMemo<Layer>(
    () => ({
      depth,
      cover: () => {
        setCovers(n => n + 1)
        return () => {
          setCovers(n => n - 1)
        }
      }
    }),
    [depth]
  )

  // Uncover the parent as soon as this modal starts closing, not after its exit animation.
  useEffect(() => (present ? parent?.cover() : undefined), [parent, present])

  useEffect(() => {
    const el = dialog.current
    if (!el) return
    const opener = document.activeElement
    if (!el.open) el.showModal()
    return () => {
      if (opener instanceof HTMLElement && opener.isConnected) opener.focus()
    }
  }, [])

  const covered = covers > 0

  return (
    <LayerContext value={layer}>
      <motion.dialog
        ref={dialog}
        initial="hidden"
        animate="shown"
        exit="hidden"
        transition={{duration: 0.3, ease: EASE}}
        inert={!present}
        aria-labelledby={labelledBy}
        aria-label={labelledBy ? undefined : label}
        onCancel={e => {
          // React bubbles `cancel` through the component tree, so without this Escape would also reach the parent modal.
          e.stopPropagation()
          e.preventDefault()
          onClose()
        }}
        style={style}
        className="fixed inset-0 m-0 grid h-full max-h-none w-full max-w-none place-items-center bg-transparent p-[var(--gutter)] text-fg backdrop:bg-transparent">
        <motion.div
          variants={BACKDROP}
          data-testid="modal-backdrop"
          aria-hidden="true"
          onClick={onClose}
          className={`absolute inset-0 ${depth === 0 ? 'bg-black/70 backdrop-blur-sm' : 'bg-black/40'}`}
        />
        <motion.div
          variants={PANEL}
          data-testid="modal-layer"
          // The layer spans the whole width, so the empty sides beside the panel land here, not on the backdrop.
          onClick={e => {
            if (e.target === e.currentTarget) onClose()
          }}
          className="relative z-10 flex max-h-full w-full justify-center">
          <motion.div
            data-covered={covered}
            initial={false}
            animate={
              covered
                ? {scale: 0.97, filter: 'brightness(0.6)'}
                : {scale: 1, filter: 'brightness(1)'}
            }
            transition={{duration: 0.25, ease: EASE}}
            className={`relative max-h-full w-full overflow-y-auto rounded-[var(--radius-card)] border border-border bg-surface ${className}`}>
            <button
              type="button"
              onClick={onClose}
              aria-label={closeLabel}
              className="absolute top-4 right-4 z-10 grid size-11 place-items-center rounded-full bg-ink/80 text-fg transition-[background-color,color,transform] duration-200 hover:bg-accent hover:text-on-accent active:scale-95">
              <X className="size-5" />
            </button>
            {children}
          </motion.div>
        </motion.div>
      </motion.dialog>
    </LayerContext>
  )
}
