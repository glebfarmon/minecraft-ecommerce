import {RichText} from '@/components/rich-text/rich-text'

import type {ProductCreate} from '@shop/shared/catalog-admin'

import {ProductCard} from './product-card'

type Translation = NonNullable<ProductCreate['translations']['en']>

/**
 * The editor's live preview: the board's tile, then what the product modal on the site shows
 * under it (the formatted description and the extra sections), in one language.
 */
export function ProductPreview({
  card,
  translation
}: {
  card: Parameters<typeof ProductCard>[0]
  translation: Translation | null
}) {
  return (
    <div className="flex flex-col gap-3">
      <ProductCard {...card} />
      {translation?.description && (
        <p className="px-1 text-[13px] leading-relaxed whitespace-pre-line text-fg/85">
          <RichText text={translation.description} links={false} />
        </p>
      )}
      {translation?.sections.map((section, si) => (
        // Index keys: sections added in the editor have no id, and titles may repeat while typed.
        <section key={si} className="flex flex-col gap-2 rounded-plate bg-card-raised p-3">
          {section.title && <h3 className="label-caps">{section.title}</h3>}
          <ul className="flex flex-col">
            {section.entries.map((entry, ei) => (
              <li
                key={ei}
                className="flex flex-wrap items-center gap-x-2 gap-y-1 border-t border-line py-2 text-[13px] first:border-0 first:pt-0 last:pb-0">
                {entry.cmd && (
                  <code className="max-w-full truncate rounded-md bg-bg/50 px-1.5 py-0.5 font-mono text-[12px]">
                    {entry.cmd}
                  </code>
                )}
                {entry.text && (
                  <span
                    className={
                      entry.cmd ? 'order-last basis-full text-muted' : 'min-w-0 flex-1 text-fg/85'
                    }>
                    {entry.text}
                  </span>
                )}
                {entry.cooldown && (
                  <span className="tabular ml-auto rounded-full border border-border px-2 py-0.5 text-[11px] text-muted">
                    {entry.cooldown}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}
