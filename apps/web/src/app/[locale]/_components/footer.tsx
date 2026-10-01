import {CopyIp} from '@/components/copy-ip'
import {OnlineDot} from '@/components/online-dot'
import {SERVER_IP, networkOnline, servers} from '@/lib/catalog'
import {useTranslations} from 'next-intl'

export function Footer() {
  const t = useTranslations('footer')
  const tNav = useTranslations('nav')
  const columns = [
    {
      title: t('shop'),
      links: servers.map(s => ({label: s.name, href: `/${s.slug}#shop`}))
    },
    {
      title: t('help'),
      links: [{label: t('faq'), href: '#faq'}, {label: t('orderStatus')}, {label: t('contact')}]
    },
    {
      title: t('legal'),
      links: [
        {label: t('terms')},
        {label: t('privacy')},
        {label: t('refunds')},
        {label: t('cookies')}
      ]
    },
    {title: t('community'), links: [{label: t('rules')}, {label: t('discord')}]}
  ]

  return (
    <footer id="footer" className="scroll-mt-24 overflow-hidden">
      <div className="mx-auto max-w-[1440px] px-[var(--gutter)]">
        <div className="border-b border-line py-10">
          <p
            aria-hidden
            className="font-display text-[clamp(4.5rem,17vw,16rem)] leading-[0.8] font-bold tracking-[-0.01em] text-fg uppercase">
            Block<span className="text-accent">haus</span>
          </p>
        </div>
        <nav
          aria-label="Footer"
          className="grid grid-cols-2 gap-x-6 gap-y-10 border-b border-line py-12 md:grid-cols-4">
          {columns.map(col => (
            <div key={col.title}>
              <p className="text-[13px] font-medium tracking-[0.02em] text-muted uppercase">
                {col.title}
              </p>
              <ul className="mt-4 flex flex-col gap-3">
                {col.links.map(link => (
                  <li key={link.label}>
                    {'href' in link && link.href ? (
                      <a href={link.href} className="text-fg/85 transition-colors hover:text-fg">
                        {link.label}
                      </a>
                    ) : (
                      <span className="text-fg/40">{link.label}</span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-line py-8">
          <span className="tabular flex items-center gap-2 text-sm text-muted">
            <OnlineDot online />
            {tNav('online', {count: networkOnline})}
          </span>
          <CopyIp ip={SERVER_IP} />
        </div>
        <div className="flex flex-col gap-2 py-8 text-xs text-muted sm:flex-row sm:justify-between">
          <span>{t('copyright', {year: new Date().getFullYear()})}</span>
          <span>{t('demo')}</span>
        </div>
      </div>
    </footer>
  )
}
