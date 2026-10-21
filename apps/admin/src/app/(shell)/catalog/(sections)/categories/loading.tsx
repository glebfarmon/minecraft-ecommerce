import {CategoriesTable} from '@/features/catalog/components/categories-table'

/** The categories page's own layout with placeholder rows. */
export default function CategoriesLoading() {
  return <CategoriesTable canEdit skeleton />
}
