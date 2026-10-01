'use client'

import {ProductDetail} from '@/features/catalog/components/product-detail'
import type {Product, Server} from '@/lib/catalog'
import {X} from 'lucide-react'
import {MotionConfig, motion} from 'motion/react'
import {useTranslations} from 'next-intl'
import {useRouter} from 'next/navigation'
import {useEffect, useId, useRef} from 'react'
import type {CSSProperties} from 'react'

export function ProductModal({product, server}: {product: Product; server: Server}) {
  const t = useTranslations('product')
  const router = useRouter()
  const dialog = useRef<HTMLDialogElement>(null)
  const titleId = useId()

  useEffect(() => {
    const el = dialog.current
    if (el && !el.open) el.showModal()
  }, [])

  return (
    <dialog
      ref={dialog}
      aria-labelledby={titleId}
      onCancel={e => {
        e.preventDefault()
        router.back()
      }}
      onClick={e => {
        if (e.target === dialog.current) router.back()
      }}
      style={{'--accent': server.accent, '--on-accent': server.onAccent} as CSSProperties}
      className="m-auto w-[min(56rem,calc(100vw-2*var(--gutter)))] max-w-none bg-transparent p-0 text-fg backdrop:bg-black/70 backdrop:backdrop-blur-sm">
      <MotionConfig reducedMotion="user">
        <motion.div
          initial={{opacity: 0, y: 24, scale: 0.98}}
          animate={{opacity: 1, y: 0, scale: 1}}
          transition={{duration: 0.35, ease: [0.16, 1, 0.3, 1]}}
          className="relative max-h-[calc(100svh-2rem)] overflow-y-auto rounded-[var(--radius-card)] border border-border bg-surface p-4 md:p-6">
          <button
            type="button"
            onClick={() => {
              router.back()
            }}
            aria-label={t('close')}
            className="absolute top-6 right-6 z-10 grid size-11 place-items-center rounded-full bg-ink/80 text-fg hover:bg-ink md:top-8 md:right-8">
            <X className="size-5" />
          </button>
          <ProductDetail product={product} server={server} titleId={titleId} />
        </motion.div>
      </MotionConfig>
    </dialog>
  )
}
