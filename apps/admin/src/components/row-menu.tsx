'use client'

import * as Menu from '@radix-ui/react-dropdown-menu'
import {MoreHorizontal} from 'lucide-react'

import {Button} from '@shop/ui/button'
import {cn} from '@shop/ui/lib/utils'

export type RowMenuItem = {label: string; onSelect: () => void; tone?: 'danger'}

export function RowMenu({label, items}: {label: string; items: RowMenuItem[]}) {
  return (
    <Menu.Root modal={false}>
      <Menu.Trigger asChild>
        <Button variant="ghost" size="icon" aria-label={label}>
          <MoreHorizontal aria-hidden />
        </Button>
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Content
          align="end"
          sideOffset={6}
          className="z-50 min-w-44 rounded-plate border border-border bg-card-raised p-1 shadow-xl shadow-black/40">
          {items.map(item => (
            <Menu.Item
              key={item.label}
              onSelect={item.onSelect}
              className={cn(
                'flex h-9 cursor-pointer items-center rounded-[10px] px-3 text-[13px] outline-none data-[highlighted]:bg-card',
                item.tone === 'danger' ? 'text-bad' : 'text-fg'
              )}>
              {item.label}
            </Menu.Item>
          ))}
        </Menu.Content>
      </Menu.Portal>
    </Menu.Root>
  )
}
