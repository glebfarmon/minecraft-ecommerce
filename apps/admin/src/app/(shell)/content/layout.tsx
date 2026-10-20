import {PageHeader} from '@/components/page-header'
import {SubNav} from '@/components/sub-nav'
import {requireMe} from '@/lib/session'
import {getTranslations} from 'next-intl/server'
import {notFound} from 'next/navigation'
import type {ReactNode} from 'react'

import {hasPermission} from '@shop/shared/access'

/** The header and pills stay mounted while Rules, Texts and Settings swap below them. */
export default async function ContentLayout({children}: {children: ReactNode}) {
  const t = await getTranslations('content')
  const tabs = [
    {href: '/content/rules', label: t('rules')},
    {href: '/content/texts', label: t('texts')},
    {href: '/content/settings', label: t('settings')}
  ]
  const me = await requireMe()
  if (!hasPermission(me.permissions, 'content.write')) notFound()
  return (
    <section className="flex flex-col gap-6">
      <PageHeader title={t('content')} description={t('rulesInterfaceTextsAndBrandSettings')} />
      <SubNav label={t('content')} items={tabs} />
      {children}
    </section>
  )
}
