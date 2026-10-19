import {PageHeader} from '@/components/page-header'
import {SubNav} from '@/components/sub-nav'
import {requireMe} from '@/lib/session'
import {notFound} from 'next/navigation'
import type {ReactNode} from 'react'

import {hasPermission} from '@shop/shared/access'

const TABS = [
  {href: '/content/rules', label: 'Rules'},
  {href: '/content/texts', label: 'Texts'},
  {href: '/content/settings', label: 'Settings'}
]

/** The header and pills stay mounted while Rules, Texts and Settings swap below them. */
export default async function ContentLayout({children}: {children: ReactNode}) {
  const me = await requireMe()
  if (!hasPermission(me.permissions, 'content.write')) notFound()
  return (
    <section className="flex flex-col gap-6">
      <PageHeader
        title="Content"
        description="Rules, interface texts and brand settings shown on the site."
      />
      <SubNav label="Content" items={TABS} />
      {children}
    </section>
  )
}
