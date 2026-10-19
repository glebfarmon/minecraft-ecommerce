import type {ReactNode} from 'react'

export function PageHeader({
  title,
  description,
  actions
}: {
  title: ReactNode
  description?: string
  actions?: ReactNode
}) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div className="flex min-w-0 flex-col gap-1">
        <h1 className="text-[28px] leading-tight font-semibold tracking-[-0.01em] [overflow-wrap:anywhere]">
          {title}
        </h1>
        {description && <p className="text-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </header>
  )
}
