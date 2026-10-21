import {ProductEditor} from '@/features/catalog/components/product-editor'

/** The editor's own layout with placeholders, so the page does not change shape when it loads. */
export default function ProductLoading() {
  return <ProductEditor canEdit skeleton />
}
