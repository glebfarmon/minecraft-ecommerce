import {PageHeader} from '@/components/page-header'
import {CatalogBoard} from '@/features/catalog/components/catalog-board'
import {requireMe} from '@/lib/session'
import Link from 'next/link'

import {hasPermission} from '@shop/shared/access'
import {Button} from '@shop/ui/button'

export default async function CatalogPage() {
  const me = await requireMe()
  return (
    <section className="flex flex-col gap-6">
      <PageHeader
        title="Catalog"
        description="Servers, categories and products. Changes are live on the site within a minute."
        actions={
          <Button asChild variant="ghost">
            <Link href="/catalog/categories">Manage categories</Link>
          </Button>
        }
      />
      <CatalogBoard canEdit={hasPermission(me.permissions, 'catalog.write')} />
    </section>
  )
}
