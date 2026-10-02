import {INNER_RADIUS, MORPH} from '@/config/motion'
import type {Product} from '@/config/products'
import {ProductIcon} from '@/features/catalog/components/product-icon'
import {motion} from 'motion/react'
import {useTranslations} from 'next-intl'

/** Typographic stand-in for a product render until real artwork exists. */
export function ProductPlate({
  product,
  size = 'card',
  layoutId
}: {
  product: Product
  size?: 'card' | 'large' | 'thumb'
  /** Share the box with the same plate in the card or the modal, so Motion carries it between the two. */
  layoutId?: string
}) {
  const t = useTranslations('catalog')
  const large = size === 'large'
  const markClass = `px-5 text-center font-display leading-none font-bold tracking-[-0.01em] uppercase transition-transform duration-300 ease-[var(--ease-out-expo)] group-hover:scale-[1.04] ${
    large ? 'text-[clamp(2.75rem,9vw,4.5rem)]' : 'text-[clamp(1.75rem,2.6vw,2.75rem)]'
  }`
  if (size === 'thumb') {
    return (
      <div className="relative grid size-full place-items-center overflow-hidden rounded-[inherit] bg-plate text-ink">
        <ProductIcon name={product.icon} className="size-6" strokeWidth={2.25} />
        <span aria-hidden className="absolute inset-x-2.5 bottom-1.5 h-1 rounded-full bg-accent" />
      </div>
    )
  }
  return (
    <motion.div
      data-testid="product-plate"
      layoutId={layoutId}
      transition={MORPH}
      style={{borderRadius: INNER_RADIUS}}
      className={`relative grid place-items-center overflow-hidden bg-plate text-ink ${large ? 'aspect-[16/7] w-full md:aspect-auto md:h-full' : 'aspect-square'}`}>
      <ProductIcon
        name={product.icon}
        className={`absolute text-accent ${large ? 'top-6 left-6 size-8' : 'top-4 left-4 size-5'}`}
        strokeWidth={2.25}
      />
      {product.adult && (
        <span
          className={`absolute rounded-full bg-ink px-2.5 py-1 text-[11px] font-bold text-fg ${large ? 'bottom-10 left-6' : 'top-3 right-3'}`}>
          {t('adult')}
        </span>
      )}
      <span className={markClass}>{product.mark}</span>
      <span aria-hidden className="absolute inset-x-6 bottom-5 h-1.5 rounded-full bg-accent" />
    </motion.div>
  )
}
