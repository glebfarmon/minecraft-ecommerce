import {Slot} from '@radix-ui/react-slot'
import {type VariantProps, cva} from 'class-variance-authority'
import type * as React from 'react'

import {cn} from './lib/utils'

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        default: 'bg-accent text-on-accent hover:bg-accent/90',
        outline: 'border border-border bg-transparent text-fg hover:bg-card-raised',
        ghost: 'bg-transparent text-muted hover:bg-card-raised hover:text-fg',
        danger: 'border border-bad/40 bg-bad-soft text-bad hover:bg-bad/20'
      },
      size: {default: 'h-9 px-4', sm: 'h-8 px-3 text-[13px]', lg: 'h-10 px-6', icon: 'size-9'}
    },
    defaultVariants: {variant: 'default', size: 'default'}
  }
)

type ButtonProps = React.ComponentProps<'button'> &
  VariantProps<typeof buttonVariants> & {asChild?: boolean}

function Button({className, variant, size, asChild = false, ...props}: ButtonProps) {
  const Comp = asChild ? Slot : 'button'
  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({variant, size, className}))}
      {...props}
    />
  )
}

export {Button, buttonVariants}
