'use client'

import * as Dialog from '@radix-ui/react-dialog'
import {Menu} from 'lucide-react'
import {useTranslations} from 'next-intl'
import {useState} from 'react'

import type {Me} from '@shop/shared/access'
import {Button} from '@shop/ui/button'

import {LanguageSwitch} from './language-switch'
import {Nav} from './nav'

export function MobileNav({me}: {me: Me}) {
  const t = useTranslations('shell')
  const [open, setOpen] = useState(false)
  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <Button variant="ghost" size="icon" aria-label={t('openMenu')} className="md:hidden">
          <Menu aria-hidden className="size-5" />
        </Button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/60" />
        <Dialog.Content
          aria-describedby={undefined}
          className="fixed inset-y-0 left-0 z-50 w-72 bg-surface p-4 focus:outline-none">
          <Dialog.Title className="label-caps mb-4 px-3">{t('menu')}</Dialog.Title>
          <Nav
            me={me}
            variant="sheet"
            onNavigate={() => {
              setOpen(false)
            }}
          />
          <div className="absolute inset-x-4 bottom-4">
            <LanguageSwitch orientation="horizontal" />
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
