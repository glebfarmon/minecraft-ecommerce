import {SettingsForm} from '@/features/content/components/settings-form'
import {requireMe} from '@/lib/session'
import {notFound} from 'next/navigation'

import {hasPermission} from '@shop/shared/access'

export default async function ContentSettingsFormPage() {
  const me = await requireMe()
  if (!hasPermission(me.permissions, 'content.write')) notFound()
  return (
    <div className="flex flex-col gap-6">
      <SettingsForm canEdit />
    </div>
  )
}
