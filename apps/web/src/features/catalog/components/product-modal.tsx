'use client'

import {Modal} from '@/components/modal'
import {ProductDetail} from '@/features/catalog/components/product-detail'
import type {Product, Server} from '@/lib/catalog'
import {useTranslations} from 'next-intl'
import {useId} from 'react'
import type {CSSProperties} from 'react'

export function ProductModal({
  product,
  server,
  open,
  onClose
}: {
  product: Product
  server: Server
  open: boolean
  onClose: () => void
}) {
  const t = useTranslations('product')
  const titleId = useId()
  return (
    <Modal
      open={open}
      onClose={onClose}
      closeLabel={t('close')}
      labelledBy={titleId}
      style={{'--accent': server.accent, '--on-accent': server.onAccent} as CSSProperties}
      className="max-w-4xl p-4 md:p-6">
      <ProductDetail product={product} server={server} titleId={titleId} onAdded={onClose} />
    </Modal>
  )
}
