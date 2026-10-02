import {
  FooterBlock,
  FooterItem,
  FooterMotion,
  FooterSpan,
  FooterWordmark
} from '@/app/[locale]/_components/footer-motion'
import {CopyIp} from '@/components/copy-ip'
import {OnlineBadge} from '@/features/status/components/online-badge'
import {SERVER_IP, servers} from '@/lib/catalog'
import {useTranslations} from 'next-intl'

export function Footer() {
  const t = useTranslations('footer')
  const columns = [
    {
      title: t('shop'),
      links: servers.map(s => ({label: s.name, href: `/${s.slug}#shop`}))
    },
    {
      title: t('help'),
      links: [{label: t('faq'), href: '#faq'}, {label: t('contact')}]
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
    <footer id="footer" className="overflow-hidden">
      <FooterMotion>
        <div className="mx-auto max-w-[1440px] px-[var(--gutter)]">
          <FooterBlock className="py-10">
            <FooterWordmark plain="Block" accent="haus" />
          </FooterBlock>
          <nav aria-label="Footer">
            <FooterBlock className="grid grid-cols-2 gap-x-6 gap-y-10 py-12 md:grid-cols-4">
              {columns.map(col => (
                <FooterItem key={col.title}>
                  <p className="eyebrow">{col.title}</p>
                  <ul className="mt-4 flex flex-col gap-3">
                    {col.links.map(link => (
                      <li key={link.label}>
                        {'href' in link && link.href ? (
                          <a
                            href={link.href}
                            className="bg-[linear-gradient(currentColor,currentColor)] bg-[length:0%_1px] bg-bottom-left bg-no-repeat pb-0.5 text-fg/85 transition-[background-size,color] duration-500 ease-out-expo hover:bg-[length:100%_1px] hover:text-fg">
                            {link.label}
                          </a>
                        ) : (
                          <span className="text-fg/40">{link.label}</span>
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
