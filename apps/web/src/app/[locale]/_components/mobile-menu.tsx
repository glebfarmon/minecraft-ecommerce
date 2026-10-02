'use client'

import {MorphPopover} from '@/components/morph-popover'
import {SettingsOptions} from '@/features/settings/components/settings-menu'
import {OnlineBadge} from '@/features/status/components/online-badge'
import {Link} from '@/i18n/navigation'
import {Menu} from 'lucide-react'
import {useTranslations} from 'next-intl'
import type {MouseEvent} from 'react'

import type {NavLinkItem} from './nav-links'

/** Burger button that morphs into a compact panel with the nav links; below `sm` it also holds the settings. */
export function MobileMenu({
  links,
  onLinkClick
}: {
  links: NavLinkItem[]
  onLinkClick: (event: MouseEvent<HTMLAnchorElement>, href: string) => void
}) {
  const t = useTranslations('nav')

  return (
    <div className="lg:hidden">
      <MorphPopover
        triggerLabel={t('menu')}
        panelLabel={t('menu')}
        closeLabel={t('closePanel')}
        triggerClassName="size-11 text-fg hover:bg-white/5"
        // Same width as the settings panel; it fits the narrowest phone (16rem < 100vw - gutters - nav padding).
        panelClassName="w-64 max-h-[calc(100svh-6rem)] overflow-y-auto"
        trigger={<Menu className="size-5" />}>
        {close => (
          <>
            <p className="px-3 pt-2 pb-1 eyebrow-sm">{t('pages')}</p>
            <ul className="flex flex-col gap-0.5">
              {links.map(link => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    onClick={event => {
                      close()
                      onLinkClick(event, link.href)
                    }}
                    className="block rounded-xl px-3 py-2.5 text-[15px] transition-colors hover:bg-white/5">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
            <div className="mx-3 my-2 h-px bg-line sm:hidden" />
            <div className="sm:hidden">
              <SettingsOptions onDone={close} />
            </div>
            <p className="tabular mt-3 flex items-center gap-2 px-3 text-sm text-muted sm:hidden">
              <OnlineBadge />
            </p>
          </>
        )}
      </MorphPopover>
    </div>
  )
}
