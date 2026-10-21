import {PageEnter} from '@/components/page-enter'
import {ServerEditor} from '@/features/catalog/components/server-editor'

/** The editor's own layout with placeholders, so the page does not change shape when it loads. */
export default function ServerLoading() {
  return (
    <PageEnter>
      <ServerEditor canEdit canRcon={false} skeleton />
    </PageEnter>
  )
}
