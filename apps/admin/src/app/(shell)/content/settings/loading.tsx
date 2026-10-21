import {PageEnter} from '@/components/page-enter'
import {SettingsForm} from '@/features/content/components/settings-form'

export default function SettingsLoading() {
  return (
    <PageEnter>
      <div className="flex flex-col gap-6">
        <SettingsForm canEdit skeleton />
      </div>
    </PageEnter>
  )
}
