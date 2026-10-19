import type {LucideIcon} from 'lucide-react'
import type {ReactNode} from 'react'

export function EmptyState({
  icon: Icon,
  title,
  action
}: {
  icon: LucideIcon
  title: string
  action?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-card border border-dashed border-border px-6 py-12 text-center">
      <span className="grid size-11 place-items-center rounded-full bg-card-raised text-muted">
        <Icon aria-hidden className="size-5" />
      </span>
      <p className="text-muted">{title}</p>
      {action}
    </div>
  )
}
