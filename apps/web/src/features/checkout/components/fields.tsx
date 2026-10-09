import {AlertCircle, Check} from 'lucide-react'
import type {ComponentProps, ReactNode} from 'react'
import {useId} from 'react'

const INPUT =
  'mt-2 h-12 w-full rounded-[var(--radius-field)] border border-border bg-bg px-4 text-base text-fg outline-none transition-colors placeholder:text-muted/70 hover:border-white/25 focus-visible:border-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent aria-invalid:border-danger'

/** The line under a field: the validation error when there is one, else the hint. */
function Note({id, hint, error}: {id: string; hint?: string; error?: string}) {
  if (error) {
    return (
      <p id={id} role="alert" className="mt-2 flex items-start gap-1.5 text-[13px] text-danger">
        <AlertCircle className="mt-px size-3.5 shrink-0" aria-hidden="true" />
        {error}
      </p>
    )
  }
  return hint ? (
    <p id={id} className="mt-2 text-[13px] text-muted">
      {hint}
    </p>
  ) : null
}

type TextFieldProps = Omit<ComponentProps<'input'>, 'id'> & {
  label: string
  hint?: string
  error?: string
}

export function TextField({label, hint, error, className = '', ...input}: TextFieldProps) {
  const id = useId()
  const noteId = `${id}-note`
  return (
    <div>
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      <input
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={error || hint ? noteId : undefined}
        {...input}
        className={`${INPUT} ${className}`}
      />
      <Note id={noteId} hint={hint} error={error} />
    </div>
  )
}

type CheckFieldProps = Omit<ComponentProps<'input'>, 'id' | 'type'> & {
  label: ReactNode
  error?: string
}

/** A checkbox row. The native input stays in the page (for keyboard, forms and screen readers); the box is drawn beside it. */
export function CheckField({label, error, ...input}: CheckFieldProps) {
  const id = useId()
  const noteId = `${id}-note`
  return (
    <div>
      <label htmlFor={id} className="flex cursor-pointer items-start gap-3">
        <input
          id={id}
          type="checkbox"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? noteId : undefined}
          {...input}
          className="peer sr-only"
        />
        <span
          aria-hidden="true"
          className="mt-px grid size-6 shrink-0 place-items-center rounded-md border border-border bg-bg text-on-accent transition-colors peer-checked:border-accent peer-checked:bg-accent peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent peer-aria-invalid:border-danger peer-checked:[&>svg]:scale-100">
          <Check className="size-4 scale-0 transition-transform duration-200 ease-out" />
        </span>
        <span className="text-sm leading-relaxed text-fg/85">{label}</span>
      </label>
      <Note id={noteId} error={error} />
    </div>
  )
}
