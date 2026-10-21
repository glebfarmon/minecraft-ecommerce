'use client'

import * as TabsPrimitive from '@radix-ui/react-tabs'
import {LayoutGroup, motion} from 'motion/react'
import * as React from 'react'

import {cn} from './lib/utils'

/** The active value, so the trigger that owns it can draw the rolling indicator. */
const ActiveContext = React.createContext<string | undefined>(undefined)

function Tabs({
  className,
  value,
  defaultValue,
  onValueChange,
  children,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Root>) {
  const [inner, setInner] = React.useState(defaultValue)
  const active = value ?? inner
  const group = React.useId()
  return (
    <TabsPrimitive.Root
      data-slot="tabs"
      className={cn('flex flex-col gap-4', className)}
      value={active}
      onValueChange={v => {
        setInner(v)
        onValueChange?.(v)
      }}
      {...props}>
      <ActiveContext.Provider value={active}>
        <LayoutGroup id={group}>{children}</LayoutGroup>
      </ActiveContext.Provider>
    </TabsPrimitive.Root>
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

function TabsTrigger({
  className,
  value,
  children,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
  const active = React.useContext(ActiveContext) === value
  return (
    <TabsPrimitive.Trigger
      data-slot="tabs-trigger"
      value={value}
      className={cn(
        'relative isolate inline-flex h-8 items-center rounded-full px-3 text-[13px] font-medium text-muted transition-colors hover:text-fg focus-visible:ring-1 focus-visible:ring-fg/25 focus-visible:outline-none focus-visible:ring-inset disabled:opacity-50 data-[state=active]:text-fg',
        className
      )}
      {...props}>
      {active && (
        <motion.span
          data-slot="tabs-indicator"
          layoutId="tabs-indicator"
          aria-hidden
          className="bg-card-raised absolute inset-0 -z-10 rounded-full"
          transition={{type: 'spring', bounce: 0, duration: 0.35}}
        />
      )}
      {children}
    </TabsPrimitive.Trigger>
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
