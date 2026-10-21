import {PageEnter} from '@/components/page-enter'
import {TextsTable} from '@/features/content/components/texts-table'

export default function TextsLoading() {
  return (
    <PageEnter>
      <div className="flex flex-col gap-6">
        <TextsTable skeleton />
      </div>
    </PageEnter>
  )
}
