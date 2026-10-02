import {CopyIp} from '@/components/copy-ip'
import {GridGuides} from '@/components/grid-guides'
import {OnlineCounter} from '@/features/status/components/online-counter'
import {SERVER_IP} from '@/lib/catalog'
import {ArrowDown, Plus} from 'lucide-react'
import * as motion from 'motion/react-client'
import {useTranslations} from 'next-intl'
import Image from 'next/image'

import steve from '../../../../public/hero-steve.webp'
import {HeroMotion, HeroSteve} from './hero-motion'

const word =
  'block font-bold leading-[0.86] tracking-[-0.045em] text-[clamp(3.75rem,10.5vw,9.75rem)] lowercase'

const EASE = [0.16, 1, 0.3, 1] as const

// The copy fades in after the headline and Steve have landed.
const rise = (delay: number) => ({
  initial: {opacity: 0, y: 12},
  animate: {opacity: 1, y: 0},
  transition: {duration: 0.6, ease: EASE, delay}
})

/** One headline line sliding up from under a mask. The mask carries the type size, so its padding (in em) is large enough that tight line-height and tracking do not clip glyphs. */
function Line({
  delay,
  className = '',
  children
}: {
  delay: number
  className?: string
  children: string
}) {
  return (
    <span
      className={`${word} ${className} -mx-[0.06em] -my-[0.14em] overflow-hidden px-[0.06em] py-[0.14em]`}>
      <motion.span
        className="block"
        initial={{y: '140%'}}
        animate={{y: 0}}
        transition={{duration: 0.7, ease: EASE, delay}}>
        {children}
      </motion.span>
    </span>
  )
}

export function Hero() {
  const t = useTranslations('hero')

  return (
    <section id="top" className="relative isolate overflow-hidden border-b border-line">
      <GridGuides />
      <HeroMotion>
        <div className="relative mx-auto grid max-w-[1440px] px-[var(--gutter)] pt-28 pb-10 md:block md:h-[max(100svh,760px)] md:pt-0 md:pb-0">
          <h1 className="md:contents">
            <span className="sr-only">{t('title')}</span>
            <span
              aria-hidden
              className="relative z-20 md:absolute md:top-[19%] md:left-[var(--gutter)]">
              <Line delay={0.12}>{t('left1')}</Line>
              <Line delay={0.18} className="ml-[0.54em] text-accent">
                {t('left2')}
              </Line>
            </span>
            <span
              aria-hidden
              className="relative z-20 mt-2 justify-self-end text-right md:absolute md:top-[27%] md:right-[var(--gutter)] md:mt-0">
              <Line delay={0.26}>{t('right1')}</Line>
              <Line delay={0.32} className="text-accent">
                {t('right2')}
              </Line>
            </span>
          </h1>

          <HeroSteve className="relative z-10 mx-auto -mt-6 h-[min(70vh,560px)] w-full max-w-[440px] md:absolute md:bottom-0 md:left-1/2 md:mt-0 md:h-[88%] md:w-auto md:max-w-none md:-translate-x-1/2">
            <Image
              src={steve}
              alt=""
              preload
              sizes="(min-width: 768px) 42vw, 90vw"
              className="relative h-full w-auto object-contain object-bottom"
            />
          </HeroSteve>

          <motion.p
            {...rise(0.45)}
            className="eyebrow max-md:mt-8 md:absolute md:top-[58%] md:left-[var(--gutter)]">
            {t('joinUs')}
          </motion.p>
          <motion.p
            {...rise(0.5)}
            className="hidden text-right eyebrow md:absolute md:top-[16%] md:right-[var(--gutter)] md:block">
            {t('newSeason')}
          </motion.p>

          <motion.p
            {...rise(0.55)}
            className="relative z-20 mt-3 max-w-[34ch] text-base leading-relaxed text-fg/85 md:absolute md:bottom-[14%] md:left-[var(--gutter)] md:mt-0 md:max-w-[min(30ch,24vw)]">
            {t('lead')}
          </motion.p>

          <motion.p
            {...rise(0.6)}
            className="text-[13px] font-medium tracking-[0.02em] text-muted max-md:mt-6 md:absolute md:bottom-10 md:left-[var(--gutter)]">
            {t('version')}
          </motion.p>

          {/* The static 30° comes from the CSS `rotate`; Motion's transform turns it in from -120° on top of that. */}
          <motion.span
            aria-hidden
            initial={{opacity: 0, scale: 0.6, rotate: -120}}
            animate={{opacity: 1, scale: 1, rotate: 0}}
            transition={{duration: 0.7, ease: EASE, delay: 0.6}}
            className="hidden size-14 rotate-[30deg] place-items-center rounded-full bg-accent text-on-accent md:absolute md:top-[68%] md:right-[19%] md:grid">
            <Plus className="size-6" strokeWidth={2.5} />
          </motion.span>

          <motion.div
            {...rise(0.65)}
            className="relative z-20 mt-8 flex flex-col items-start gap-4 md:absolute md:right-[var(--gutter)] md:bottom-10 md:mt-0 md:items-end">
            <OnlineCounter />
            <div className="flex flex-wrap items-center gap-2 md:justify-end">
              <CopyIp ip={SERVER_IP} />
              <a
                href="#shop"
                className="flex h-12 items-center gap-2 rounded-full bg-accent pr-5 pl-6 font-semibold text-on-accent shadow-[0_8px_24px_var(--color-accent-soft)] transition-[filter] hover:brightness-110">
                {t('browse')}
                <ArrowDown className="size-4" />
              </a>
            </div>
          </motion.div>
        </div>
      </HeroMotion>
    </section>
  )
}
