import {CopyIp} from '@/components/copy-ip'
import {GridGuides} from '@/components/grid-guides'
import {OnlineCounter} from '@/features/status/components/online-counter'
import {SERVER_IP} from '@/lib/catalog'
import {ArrowDown, Plus} from 'lucide-react'
import {useTranslations} from 'next-intl'
import Image from 'next/image'

import steve from '../../../../public/hero-steve.webp'

const word =
  'block font-bold leading-[0.86] tracking-[-0.045em] text-[clamp(3.75rem,10.5vw,9.75rem)] lowercase'

export function Hero() {
  const t = useTranslations('hero')

  return (
    <section id="top" className="relative isolate overflow-hidden border-b border-line">
      <GridGuides />
      <div className="relative mx-auto grid max-w-[1440px] px-[var(--gutter)] pt-28 pb-10 md:block md:h-[max(100svh,760px)] md:pt-0 md:pb-0">
        <h1 className="md:contents">
          <span className="sr-only">{t('title')}</span>
          <span
            aria-hidden
            className="relative z-20 md:absolute md:top-[19%] md:left-[var(--gutter)]">
            <span className={word}>{t('left1')}</span>
            <span className={`${word} ml-[0.6em] text-accent`}>{t('left2')}</span>
          </span>
          <span
            aria-hidden
            className="relative z-20 mt-2 justify-self-end text-right md:absolute md:top-[27%] md:right-[var(--gutter)] md:mt-0">
            <span className={word}>{t('right1')}</span>
            <span className={`${word} text-accent`}>{t('right2')}</span>
          </span>
        </h1>

        <div className="relative z-10 mx-auto -mt-6 h-[min(70vh,560px)] w-full max-w-[440px] md:absolute md:bottom-0 md:left-1/2 md:mt-0 md:h-[88%] md:w-auto md:max-w-none md:-translate-x-1/2">
          <div
            aria-hidden
            className="absolute inset-x-[10%] top-[18%] bottom-[8%] rounded-full bg-accent-soft blur-3xl"
          />
          <Image
            src={steve}
            alt=""
            preload
            sizes="(min-width: 768px) 42vw, 90vw"
            className="relative h-full w-auto object-contain object-bottom"
          />
        </div>

        <p className="text-[13px] font-medium tracking-[0.02em] text-muted uppercase max-md:mt-8 md:absolute md:top-[58%] md:left-[var(--gutter)]">
          {t('joinUs')}
        </p>
        <p className="hidden text-right text-[13px] font-medium tracking-[0.02em] text-muted uppercase md:absolute md:top-[16%] md:right-[var(--gutter)] md:block">
          {t('newSeason')}
        </p>

        <p className="relative z-20 mt-3 max-w-[34ch] text-base leading-relaxed text-fg/85 md:absolute md:bottom-[14%] md:left-[var(--gutter)] md:mt-0 md:max-w-[min(30ch,24vw)]">
          {t('lead')}
        </p>

        <p className="text-[13px] font-medium tracking-[0.02em] text-muted max-md:mt-6 md:absolute md:bottom-10 md:left-[var(--gutter)]">
          {t('version')}
        </p>

        <span
          aria-hidden
          className="hidden size-14 rotate-[30deg] place-items-center rounded-full bg-accent text-on-accent md:absolute md:top-[60%] md:right-[19%] md:grid">
          <Plus className="size-6" strokeWidth={2.5} />
        </span>

        <div className="relative z-20 mt-8 flex flex-col items-start gap-4 md:absolute md:right-[var(--gutter)] md:bottom-10 md:mt-0 md:items-end">
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
        </div>
      </div>
    </section>
  )
}
