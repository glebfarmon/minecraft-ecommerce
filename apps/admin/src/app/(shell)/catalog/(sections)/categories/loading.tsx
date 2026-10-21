import {PageEnter} from '@/components/page-enter'
import {CategoriesTable} from '@/features/catalog/components/categories-table'

/** The categories page's own layout with placeholder rows. */
export default function CategoriesLoading() {
  return (
    <PageEnter>
      <CategoriesTable canEdit skeleton />
    </PageEnter>
  )
}
