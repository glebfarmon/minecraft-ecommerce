import {RulesEditor} from '@/features/content/components/rules-editor'
import {VersionsList} from '@/features/content/components/versions-list'

export default function RulesLoading() {
  return (
    <div className="flex flex-col gap-6">
      <RulesEditor skeleton />
      <VersionsList skeleton />
    </div>
  )
}
