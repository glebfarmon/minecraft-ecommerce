import type {ReactNode} from 'react'

export function FormSection({
  title,
  description,
  children
}: {
  title: string
  description?: string
  children: ReactNode
}) {
  return (
    <fieldset className="flex min-w-0 flex-col gap-4 rounded-card bg-card p-5">
      <legend className="float-left mb-1 w-full">
        <span className="block text-[15px] font-semibold">{title}</span>
        {description && <span className="mt-1 block text-[13px] text-muted">{description}</span>}
      </legend>
      <div className="clear-both grid gap-4 md:grid-cols-2">{children}</div>
    </fieldset>
  )
}
