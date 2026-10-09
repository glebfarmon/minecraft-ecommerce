'use client'

import {Modal} from '@/components/modal'
import type {Product} from '@/config/products'
import type {Server} from '@/config/servers'
import {ProductDetail} from '@/features/catalog/components/product-detail'
import {productLayoutId} from '@/lib/catalog'
import {useTranslations} from 'next-intl'
import {useId} from 'react'
import type {CSSProperties} from 'react'

export function ProductModal({
  product,
  server,
  open,
  onClose,
  onAdded,
  onClosed
}: {
  product: Product
  server: Server
  open: boolean
  onClose: () => void
  /** The player added the product; the owner decides how the modal goes away. */
  onAdded: () => void
  /** The modal has finished closing. */
  onClosed: () => void
}) {
  const t = useTranslations('product')
  const titleId = useId()
  return (
    <Modal
      open={open}
      onClose={onClose}
      onClosed={onClosed}
      closeLabel={t('close')}
      labelledBy={titleId}
      layoutId={productLayoutId(product)}
      style={{'--accent': server.accent, '--on-accent': server.onAccent} as CSSProperties}
      className="max-w-4xl scroll-pb-28 p-4 md:p-5">
      {/* No fade wrapper here: the plate is a shared element and must stay visible; ProductDetail fades its other parts itself. */}
      <ProductDetail product={product} server={server} titleId={titleId} onAdded={onAdded} />
    </Modal>
  )
}
