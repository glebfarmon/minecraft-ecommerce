import {Card} from '@/components/card'
import {PageHeader} from '@/components/page-header'
import {useTranslations} from 'next-intl'
import type {ReactNode} from 'react'

/** Page header, the form column and a sticky live preview (from xl up). */
export function EditorLayout({
  title,
  preview,
  children
}: {
  title: string
  preview: ReactNode
  children: ReactNode
}) {
  const t = useTranslations('catalog')
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={title} back={{href: '/catalog', label: t('backToCatalog')}} />
      <div className="grid items-start gap-4 xl:grid-cols-[1fr_20rem]">
        <div className="flex min-w-0 flex-col gap-4">{children}</div>
        <aside className="sticky top-4 hidden xl:block">
          <Card title={t('preview')}>{preview}</Card>
        </aside>
      </div>
    </div>
  )
}
