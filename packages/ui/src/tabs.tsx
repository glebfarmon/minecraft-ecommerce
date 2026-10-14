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
      className={cn('inline-flex h-9 w-fit items-center gap-1 rounded-md border p-1', className)}
      {...props}
    />
  )
}

function TabsTrigger({className, ...props}: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      data-slot="tabs-trigger"
      className={cn(
        'inline-flex items-center rounded px-3 py-1 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:outline-none disabled:opacity-50 data-[state=active]:bg-accent',
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
