import {Card} from '@/components/card'
import {PageHeader} from '@/components/page-header'
import {Skeleton} from '@/components/skeleton'
import {useTranslations} from 'next-intl'
import type {ReactNode} from 'react'

/** Page header, the form column and a sticky live preview (from xl up). */
export function EditorLayout({
  title,
  preview,
  previewTitle,
  loading = false,
  children
}: {
  /** Ignored while `loading`: the stored name is not known yet. */
  title: string
  preview: ReactNode
  /** Defaults to "Preview". */
  previewTitle?: string
  /** The editor's own layout with placeholders: static labels stay, stored values shimmer. */
  loading?: boolean
  children: ReactNode
}) {
  const t = useTranslations('catalog')
  const common = useTranslations('common')
  return (
    <div className="flex flex-col gap-6">
      {loading && (
        <span role="status" className="sr-only">
          {common('loading')}
        </span>
      )}
      <PageHeader
        title={loading ? <Skeleton className="my-[3px] h-7 w-56 max-w-full rounded-full" /> : title}
        back={{href: '/catalog', label: t('backToCatalog')}}
      />
      <div className="grid items-start gap-4 xl:grid-cols-[1fr_20rem]">
        <div className="flex min-w-0 flex-col gap-4">{children}</div>
        <aside className="sticky top-4 hidden xl:block">
          <Card title={previewTitle ?? t('preview')}>{preview}</Card>
        </aside>
      </div>
    </div>
  )
}
