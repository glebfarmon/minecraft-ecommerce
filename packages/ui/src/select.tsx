'use client'

import * as SelectPrimitive from '@radix-ui/react-select'
import {ChevronDown} from 'lucide-react'
import {LayoutGroup, motion} from 'motion/react'
import * as React from 'react'

import {cn} from './lib/utils'

type Option = {value: string; label: string}

/**
 * A designed select on Radix: the list unfolds out of the field and the highlight rolls between
 * options. Keyframes (`select-*`, `check-draw`) live in the app stylesheet. `''` means nothing
 * chosen and shows `placeholder`; it stays controlled (an option itself may not be `''`).
 */
function Select({
  id,
  value,
  onValueChange,
  placeholder,
  options,
  disabled,
  className,
  'aria-invalid': ariaInvalid,
  'aria-describedby': ariaDescribedBy,
  'aria-label': ariaLabel
}: {
  'id'?: string
  'value': string
  'onValueChange': (value: string) => void
  'placeholder'?: string
  'options': Option[]
  'disabled'?: boolean
  'className'?: string
  'aria-invalid'?: boolean
  'aria-describedby'?: string
  'aria-label'?: string
}) {
  const [highlighted, setHighlighted] = React.useState<string | null>(null)
  const group = React.useId()
  return (
    <SelectPrimitive.Root
      value={value}
      onValueChange={onValueChange}
      disabled={disabled}
      onOpenChange={open => {
        setHighlighted(open ? value : null)
      }}>
      <SelectPrimitive.Trigger
        id={id}
        data-slot="select"
        aria-invalid={ariaInvalid}
        aria-describedby={ariaDescribedBy}
        aria-label={ariaLabel}
        className={cn(
          'group rounded-plate aria-invalid:border-bad flex h-9 min-w-0 items-center justify-between gap-2 border border-border bg-surface px-3 text-left text-sm text-fg transition-colors hover:border-white/20 focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 data-[placeholder]:text-muted',
          className
        )}>
        <span className="truncate">
          <SelectPrimitive.Value placeholder={placeholder} />
        </span>
        <SelectPrimitive.Icon asChild>
          <ChevronDown
            aria-hidden
            className="size-4 shrink-0 text-muted transition-transform duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] group-data-[state=open]:rotate-180"
          />
        </SelectPrimitive.Icon>
      </SelectPrimitive.Trigger>
      <SelectPrimitive.Portal>
        <SelectPrimitive.Content
          position="popper"
          sideOffset={6}
          className="select-content rounded-plate bg-card-raised z-50 max-h-72 min-w-[var(--radix-select-trigger-width)] overflow-hidden p-1 shadow-lg shadow-black/40">
          <SelectPrimitive.Viewport>
            <LayoutGroup id={group}>
              {options.map((o, i) => (
                <SelectPrimitive.Item
                  key={o.value}
                  value={o.value}
                  style={{'--i': i} as React.CSSProperties}
                  onFocus={() => {
                    setHighlighted(o.value)
                  }}
                  className="select-item relative isolate flex cursor-pointer items-center justify-between gap-3 rounded-[10px] px-3 py-2 text-[13px] text-muted outline-none select-none data-[highlighted]:text-fg data-[state=checked]:text-fg">
                  {highlighted === o.value && (
                    <motion.span
                      data-slot="select-indicator"
                      layoutId="select-indicator"
                      aria-hidden
                      className="absolute inset-0 -z-10 rounded-[10px] bg-card"
                      transition={{type: 'spring', bounce: 0, duration: 0.25}}
                    />
                  )}
                  <SelectPrimitive.ItemText>{o.label}</SelectPrimitive.ItemText>
                  <SelectPrimitive.ItemIndicator>
                    <svg aria-hidden viewBox="0 0 16 16" className="size-4 text-accent">
                      <path
                        d="M3.5 8.5l3 3 6-7"
                        pathLength={1}
                        className="check-draw"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={2}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </SelectPrimitive.ItemIndicator>
                </SelectPrimitive.Item>
              ))}
            </LayoutGroup>
          </SelectPrimitive.Viewport>
        </SelectPrimitive.Content>
      </SelectPrimitive.Portal>
    </SelectPrimitive.Root>
  )
}

export {Select}
