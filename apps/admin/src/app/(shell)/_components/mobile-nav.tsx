'use client'

import * as Dialog from '@radix-ui/react-dialog'
import {Menu} from 'lucide-react'
import {useState} from 'react'

import type {Me} from '@shop/shared/access'
import {Button} from '@shop/ui/button'

import {Nav} from './nav'

export function MobileNav({me}: {me: Me}) {
  const [open, setOpen] = useState(false)
  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <Button variant="ghost" size="icon" aria-label="Open menu" className="md:hidden">
          <Menu aria-hidden className="size-5" />
        </Button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/60" />
        <Dialog.Content
          aria-describedby={undefined}
          className="fixed inset-y-0 left-0 z-50 w-72 bg-surface p-4 focus:outline-none">
          <Dialog.Title className="label-caps mb-4 px-3">Menu</Dialog.Title>
          <Nav
            me={me}
            variant="sheet"
            onNavigate={() => {
              setOpen(false)
            }}
          />
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
