'use client'

import * as Dialog from '@radix-ui/react-dialog'
import {Menu, X} from 'lucide-react'
import {AnimatePresence, motion} from 'motion/react'
import {useTranslations} from 'next-intl'
import {useState} from 'react'

import type {Me} from '@shop/shared/access'
import {Button} from '@shop/ui/button'

import {LanguageSwitch} from './language-switch'
import {Nav} from './nav'

/** Same spring as `RollingIndicator`; closing is a little quicker than opening. */
const OPEN = {type: 'spring', bounce: 0, duration: 0.35} as const
const CLOSE = {type: 'spring', bounce: 0, duration: 0.25} as const

export function MobileNav({me}: {me: Me}) {
  const t = useTranslations('shell')
  const [open, setOpen] = useState(false)
  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <Button variant="ghost" size="icon" aria-label={t('openMenu')} className="md:hidden">
          <span className="relative size-5">
            <AnimatePresence initial={false}>
              <motion.span
                key={open ? 'x' : 'menu'}
                className="absolute inset-0"
                initial={{opacity: 0, rotate: open ? -90 : 90}}
                animate={{opacity: 1, rotate: 0}}
                exit={{opacity: 0, rotate: open ? -90 : 90}}
                transition={{duration: 0.2, ease: 'easeOut'}}>
                {open ? (
                  <X aria-hidden className="size-5" />
                ) : (
                  <Menu aria-hidden className="size-5" />
                )}
              </motion.span>
            </AnimatePresence>
          </span>
        </Button>
      </Dialog.Trigger>
      <AnimatePresence>
        {open && (
          <Dialog.Portal forceMount>
            <Dialog.Overlay asChild forceMount>
              <motion.div
                className="fixed inset-0 z-40 bg-black"
                initial={{opacity: 0}}
                animate={{opacity: 0.6, transition: {duration: 0.2, ease: 'easeOut'}}}
                exit={{opacity: 0, transition: {duration: 0.15, ease: 'easeOut'}}}
              />
            </Dialog.Overlay>
            <Dialog.Content asChild forceMount aria-describedby={undefined}>
              <motion.div
                className="fixed inset-y-0 left-0 z-50 w-72 bg-surface p-4 focus:outline-none"
                initial={{x: '-100%'}}
                animate={{x: 0, transition: OPEN}}
                exit={{x: '-100%', transition: CLOSE}}>
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
              </motion.div>
            </Dialog.Content>
          </Dialog.Portal>
        )}
      </AnimatePresence>
    </Dialog.Root>
  )
}
