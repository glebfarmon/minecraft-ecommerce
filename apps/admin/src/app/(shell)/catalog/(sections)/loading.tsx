import {PageEnter} from '@/components/page-enter'
import {CatalogBoard} from '@/features/catalog/components/catalog-board'

/** The board's own layout with placeholders, so the page does not change shape when it loads. */
export default function CatalogLoading() {
  return (
    <PageEnter>
      <CatalogBoard canEdit skeleton />
    </PageEnter>
  )
}
