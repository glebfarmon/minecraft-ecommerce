import { ProductIcon } from '@/components/product-icon';
import type { Product } from '@/lib/catalog';
import { useTranslations } from 'next-intl';

/** Typographic stand-in for a product render until real artwork exists. */
export function ProductPlate({
  product,
  size = 'card',
}: {
  product: Product;
  size?: 'card' | 'large';
}) {
  const t = useTranslations('catalog');
  const large = size === 'large';
  return (
    <div className="relative grid aspect-square place-items-center overflow-hidden rounded-[var(--radius-inner)] bg-plate text-ink">
      <ProductIcon
        name={product.icon}
        className={`absolute text-accent ${large ? 'top-6 left-6 size-8' : 'top-4 left-4 size-5'}`}
        strokeWidth={2.25}
      />
      {product.adult && (
        <span className="absolute top-3 right-3 rounded-full bg-ink px-2.5 py-1 text-[11px] font-bold text-fg">
          {t('adult')}
        </span>
      )}
      <span
        className={`px-5 text-center font-display leading-none font-bold tracking-[-0.01em] uppercase transition-transform duration-300 ease-[var(--ease-out-expo)] group-hover:scale-[1.04] ${
          large ? 'text-[clamp(3rem,8vw,5.5rem)]' : 'text-[clamp(1.75rem,2.6vw,2.75rem)]'
        }`}
      >
        {product.mark}
      </span>
      <span aria-hidden className="absolute inset-x-6 bottom-5 h-1.5 rounded-full bg-accent" />
    </div>
  );
}
