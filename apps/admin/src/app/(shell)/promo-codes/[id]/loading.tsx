import {PageEnter} from '@/components/page-enter'
import {PromoEditor} from '@/features/promo/components/promo-editor'

/** The editor's own layout with placeholders, so the page does not change shape when it loads. */
export default function PromoCodeLoading() {
  return (
    <PageEnter>
      <PromoEditor skeleton />
    </PageEnter>
  )
}
