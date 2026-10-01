import {Slot} from '@radix-ui/react-slot'
import {type VariantProps, cva} from 'class-variance-authority'
import type * as React from 'react'

import {cn} from './lib/utils'

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 rounded-md text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground hover:bg-primary/90',
        outline: 'border-input bg-background hover:bg-accent border'
      },
      size: {
        default: 'h-9 px-4 py-2',
        lg: 'h-10 px-6'
      }
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
