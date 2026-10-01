import {CopyIp} from '@/components/copy-ip'
import {GridGuides} from '@/components/grid-guides'
import {OnlineDot} from '@/components/online-dot'
import {SERVER_IP, networkOnline} from '@/lib/catalog'
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
      <div className="relative mx-auto grid max-w-[1440px] px-[var(--gutter)] pt-28 pb-10 lg:block lg:h-[max(100svh,760px)] lg:pt-0 lg:pb-0">
        <h1 className="lg:contents">
          <span className="sr-only">{t('title')}</span>
          <span
            aria-hidden
            className="relative z-20 lg:absolute lg:top-[19%] lg:left-[var(--gutter)]">
            <span className={word}>{t('left1')}</span>
            <span className={`${word} ml-[0.6em] text-accent`}>{t('left2')}</span>
          </span>
          <span
            aria-hidden
            className="relative z-20 mt-2 justify-self-end text-right lg:absolute lg:top-[27%] lg:right-[var(--gutter)] lg:mt-0">
            <span className={word}>{t('right1')}</span>
            <span className={`${word} text-accent`}>{t('right2')}</span>
          </span>
        </h1>

        <div className="relative z-10 mx-auto -mt-6 h-[min(70vh,560px)] w-full max-w-[440px] lg:absolute lg:bottom-0 lg:left-1/2 lg:mt-0 lg:h-[88%] lg:w-auto lg:max-w-none lg:-translate-x-1/2">
          <div
            aria-hidden
            className="absolute inset-x-[10%] top-[18%] bottom-[8%] rounded-full bg-accent-soft blur-3xl"
          />
          <Image
            src={steve}
            alt=""
            preload
            sizes="(min-width: 1024px) 42vw, 90vw"
            className="relative h-full w-auto object-contain object-bottom"
          />
        </div>

        <p className="text-[13px] font-medium tracking-[0.02em] text-muted uppercase max-lg:mt-8 lg:absolute lg:top-[58%] lg:left-[var(--gutter)]">
          {t('joinUs')}
        </p>
        <p className="hidden text-right text-[13px] font-medium tracking-[0.02em] text-muted uppercase lg:absolute lg:top-[16%] lg:right-[var(--gutter)] lg:block">
          {t('newSeason')}
        </p>

        <p className="relative z-20 mt-3 max-w-[34ch] text-base leading-relaxed text-fg/85 lg:absolute lg:bottom-[14%] lg:left-[var(--gutter)] lg:mt-0 lg:max-w-[min(30ch,24vw)]">
          {t('lead')}
        </p>

        <p className="text-[13px] font-medium tracking-[0.02em] text-muted max-lg:mt-6 lg:absolute lg:bottom-10 lg:left-[var(--gutter)]">
          {t('version')}
        </p>

        <span
          aria-hidden
          className="hidden size-14 rotate-[30deg] place-items-center rounded-full bg-accent text-on-accent lg:absolute lg:top-[60%] lg:right-[19%] lg:grid">
          <Plus className="size-6" strokeWidth={2.5} />
        </span>

        <div className="relative z-20 mt-8 flex flex-col items-start gap-4 lg:absolute lg:right-[var(--gutter)] lg:bottom-10 lg:mt-0 lg:items-end">
          <div
            className="flex items-center gap-3"
            role="status"
            aria-label={t('onlineLabel', {count: networkOnline})}>
            <span className="tabular text-[clamp(3rem,5vw,4.25rem)] leading-none font-bold tracking-[-0.04em]">
              {networkOnline}
            </span>
            <span className="flex flex-col gap-1.5">
              <OnlineDot online />
              <span className="text-[13px] font-medium tracking-[0.02em] text-muted uppercase">
                {t('playersOnline')}
              </span>
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2 lg:justify-end">
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
