import {TextsTable} from '@/features/content/components/texts-table'

export default function TextsLoading() {
  return (
    <div className="flex flex-col gap-6">
      <TextsTable skeleton />
    </div>
  )
}
