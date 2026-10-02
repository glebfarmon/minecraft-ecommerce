import {
  FooterBlock,
  FooterItem,
  FooterMotion,
  FooterSpan,
  FooterWordmark
} from '@/app/[locale]/_components/footer-motion'
import {CopyIp} from '@/components/copy-ip'
import {OnlineBadge} from '@/features/status/components/online-badge'
import {Link} from '@/i18n/navigation'
import {SERVER_IP, servers} from '@/lib/catalog'
import {useLocale, useTranslations} from 'next-intl'

const LINK_CLASS =
  'bg-[linear-gradient(currentColor,currentColor)] bg-[length:0%_1px] bg-bottom-left bg-no-repeat pb-0.5 text-fg/85 transition-[background-size,color] duration-500 ease-out-expo hover:bg-[length:100%_1px] hover:text-fg'

export function Footer() {
  const t = useTranslations('footer')
  const locale = useLocale()
  const columns = [
    {
      title: t('shop'),
      links: servers.map(s => ({label: s.name, href: `/${s.slug}#shop`}))
    },
    {
      title: t('help'),
      links: [
        {label: t('faq'), href: '#faq'},
        {label: t('contact'), href: '/contacts'}
      ]
    },
    {
      title: t('legal'),
      links: [
        {label: t('terms'), href: `/legal/terms.${locale}.pdf`, file: true},
        {label: t('privacy'), href: `/legal/privacy.${locale}.pdf`, file: true},
        {label: t('refunds'), href: `/legal/refunds.${locale}.pdf`, file: true},
        {label: t('cookies'), href: `/legal/cookies.${locale}.pdf`, file: true}
      ]
    },
    {
      title: t('community'),
      links: [
        {label: t('rules'), href: '/rules'},
        {label: t('discord'), href: 'https://discord.com'}
      ]
    }
  ]

  return (
    <footer id="footer" className="overflow-hidden">
      <FooterMotion>
        <div className="mx-auto max-w-[1440px] px-[var(--gutter)]">
          <FooterBlock className="py-10">
            <FooterWordmark plain="Block" accent="haus" />
          </FooterBlock>
          <nav aria-label={t('navLabel')}>
            <FooterBlock className="grid grid-cols-2 gap-x-6 gap-y-10 py-12 md:grid-cols-4">
              {columns.map(col => (
                <FooterItem key={col.title}>
                  <p className="eyebrow">{col.title}</p>
                  <ul className="mt-4 flex flex-col gap-3">
                    {col.links.map(link => (
                      <li key={link.label}>
                        {'file' in link || link.href.startsWith('https://') ? (
                          <a
                            href={link.href}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={LINK_CLASS}>
                            {link.label}
                          </a>
                        ) : (
                          <Link href={link.href} className={LINK_CLASS}>
                            {link.label}
                          </Link>
                        )}
                      </li>
                    ))}
                  </ul>
                </FooterItem>
              ))}
            </FooterBlock>
          </nav>
          <FooterBlock className="flex flex-wrap items-center justify-between gap-4 py-8">
            <FooterSpan className="tabular flex items-center gap-2 text-sm text-muted">
              <OnlineBadge />
            </FooterSpan>
            <FooterItem>
              <CopyIp ip={SERVER_IP} />
            </FooterItem>
          </FooterBlock>
          <FooterBlock
            rule={false}
            className="flex flex-col gap-2 py-8 text-xs text-muted sm:flex-row sm:justify-between">
            <FooterSpan>{t('copyright', {year: new Date().getFullYear()})}</FooterSpan>
            <FooterSpan>{t('demo')}</FooterSpan>
          </FooterBlock>
        </div>
      </FooterMotion>
    </footer>
  )
}
