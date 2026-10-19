import type {ReactElement} from 'react'

import {Tooltip, TooltipContent, TooltipTrigger} from '@shop/ui/tooltip'

/** The admin's tooltip: a short label for an icon or badge, never the only way to learn it. */
export function Hint({
  label,
  side = 'top',
  children
}: {
  label: string
  side?: 'top' | 'right' | 'bottom' | 'left'
  children: ReactElement
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side={side}>{label}</TooltipContent>
    </Tooltip>
  )
}
