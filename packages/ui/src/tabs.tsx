import * as TabsPrimitive from '@radix-ui/react-tabs'
import type * as React from 'react'

import {cn} from './lib/utils'

function Tabs({className, ...props}: React.ComponentProps<typeof TabsPrimitive.Root>) {
  return (
    <TabsPrimitive.Root
      data-slot="tabs"
      className={cn('flex flex-col gap-4', className)}
      {...props}
    />
  )
}

function TabsList({className, ...props}: React.ComponentProps<typeof TabsPrimitive.List>) {
  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      className={cn('inline-flex w-fit items-center gap-1 rounded-full bg-surface p-1', className)}
      {...props}
    />
  )
}

function TabsTrigger({className, ...props}: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      data-slot="tabs-trigger"
      className={cn(
        'data-[state=active]:bg-card-raised inline-flex h-8 items-center rounded-full px-3 text-[13px] font-medium text-muted transition-colors focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none disabled:opacity-50 data-[state=active]:text-fg',
        className
      )}
      {...props}
    />
  )
}

function TabsContent({className, ...props}: React.ComponentProps<typeof TabsPrimitive.Content>) {
  return (
    <TabsPrimitive.Content
      data-slot="tabs-content"
      className={cn('focus-visible:outline-none', className)}
      {...props}
    />
  )
}

export {Tabs, TabsContent, TabsList, TabsTrigger}
