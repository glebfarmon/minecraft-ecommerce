import {SettingsForm} from '@/features/content/components/settings-form'

export default function SettingsLoading() {
  return (
    <div className="flex flex-col gap-6">
      <SettingsForm canEdit skeleton />
    </div>
  )
}
