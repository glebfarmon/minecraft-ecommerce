import {PageHeader} from '@/components/page-header'
import {CategoriesTable} from '@/features/catalog/components/categories-table'
import {requireMe} from '@/lib/session'
import {ArrowLeft} from 'lucide-react'
import Link from 'next/link'

import {hasPermission} from '@shop/shared/access'
import {Button} from '@shop/ui/button'

export default async function CategoriesPage() {
  const me = await requireMe()
  return (
    <section className="flex flex-col gap-6">
      <PageHeader
        title="Categories"
        description="Shared across servers; attach them to a server on the catalog page."
        actions={
          <Button asChild variant="ghost">
            <Link href="/catalog">
              <ArrowLeft aria-hidden className="size-4" />
              Back to catalog
            </Link>
          </Button>
        }
      />
      <CategoriesTable canEdit={hasPermission(me.permissions, 'catalog.write')} />
    </section>
  )
}
