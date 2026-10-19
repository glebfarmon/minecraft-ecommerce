import {Card} from '@/components/card'
import {PageHeader} from '@/components/page-header'
import {ArrowLeft} from 'lucide-react'
import Link from 'next/link'
import type {ReactNode} from 'react'

import {Button} from '@shop/ui/button'

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
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={title}
        actions={
          <Button asChild variant="ghost">
            <Link href="/catalog">
              <ArrowLeft aria-hidden className="size-4" />
              Back to catalog
            </Link>
          </Button>
        }
      />
      <div className="grid items-start gap-4 xl:grid-cols-[1fr_20rem]">
        <div className="flex min-w-0 flex-col gap-4">{children}</div>
        <aside className="sticky top-4 hidden xl:block">
          <Card title="Preview">{preview}</Card>
        </aside>
      </div>
    </div>
  )
}
