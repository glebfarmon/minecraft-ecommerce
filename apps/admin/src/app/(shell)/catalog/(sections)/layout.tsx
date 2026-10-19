import {PageHeader} from '@/components/page-header'
import {SubNav} from '@/components/sub-nav'
import type {ReactNode} from 'react'

const TABS = [
  {href: '/catalog', label: 'Products'},
  {href: '/catalog/categories', label: 'Categories'}
]

/** Products and Categories share the header and pills; editors under /catalog/* do not. */
export default function CatalogSectionsLayout({children}: {children: ReactNode}) {
  return (
    <section className="flex flex-col gap-6">
      <PageHeader
        title="Catalog"
        description="Servers, categories and products. Changes are live on the site within a minute."
      />
      <SubNav label="Catalog" items={TABS} />
      {children}
    </section>
  )
}
