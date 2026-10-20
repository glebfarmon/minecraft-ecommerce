import {PageHeader} from '@/components/page-header'
import {SubNav} from '@/components/sub-nav'
import {useTranslations} from 'next-intl'
import type {ReactNode} from 'react'

/** Products and Categories share the header and pills; editors under /catalog/* do not. */
export default function CatalogSectionsLayout({children}: {children: ReactNode}) {
  const t = useTranslations('catalog')
  const tabs = [
    {href: '/catalog', label: t('products')},
    {href: '/catalog/categories', label: t('categories')}
  ]
  return (
    <section className="flex flex-col gap-6">
      <PageHeader title={t('catalog')} description={t('serversCategoriesAndProductsChangesAre')} />
      <SubNav label={t('catalog')} items={tabs} />
      {children}
    </section>
  )
}
