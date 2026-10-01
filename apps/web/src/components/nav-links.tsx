'use client'

import {Link} from '@/i18n/navigation'
import {AnimatePresence, LayoutGroup, MotionConfig, motion} from 'motion/react'
import type {MouseEvent} from 'react'
import {useState} from 'react'

export type NavLinkItem = {href: string; label: string}

export function NavLinks({
  links,
  onLinkClick
}: {
  links: NavLinkItem[]
  onLinkClick: (event: MouseEvent<HTMLAnchorElement>, href: string) => void
}) {
  const [hovered, setHovered] = useState<string | null>(null)

  return (
    <MotionConfig reducedMotion="user">
      <LayoutGroup id="main-nav">
        {/* Links touch (padding, no gap), so the cursor never falls between them and the pill slides instead of blinking. */}
        <ul
          onPointerLeave={() => {
            setHovered(null)
          }}
          className="mx-auto hidden items-center lg:flex">
          {links.map(link => (
            <li key={link.href}>
              <Link
                href={link.href}
                // Touch taps emulate hover with no leave afterwards, so only a real mouse shows the pill.
                onPointerEnter={event => {
                  if (event.pointerType === 'mouse') setHovered(link.href)
                }}
                onClick={event => {
                  onLinkClick(event, link.href)
                }}
                className="relative flex h-11 items-center justify-center px-4 text-[13px] font-semibold tracking-[0.14em] text-muted uppercase transition-colors hover:text-fg">
                <AnimatePresence>
                  {hovered === link.href && (
                    <motion.span
                      layoutId="nav-hover-pill"
                      data-nav-pill
                      aria-hidden="true"
                      initial={{opacity: 0}}
                      animate={{opacity: 1}}
                      exit={{opacity: 0}}
                      transition={{type: 'spring', bounce: 0.15, duration: 0.35}}
                      className="absolute inset-x-0 inset-y-1 rounded-full bg-white/[0.07] shadow-[inset_0_0_0_1px_rgb(255_255_255/0.05)]"
                    />
                  )}
                </AnimatePresence>
                <span className="relative z-10">{link.label}</span>
              </Link>
            </li>
          ))}
        </ul>
      </LayoutGroup>
    </MotionConfig>
  )
}
