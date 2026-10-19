import Link from 'next/link'

const TABS = [
  {href: '/content/rules', label: 'Rules'},
  {href: '/content/texts', label: 'Texts'},
  {href: '/content/settings', label: 'Settings'}
]

export function ContentTabs({
  current
}: {
  current: '/content/rules' | '/content/texts' | '/content/settings'
}) {
  return (
    <nav aria-label="Content" className="flex w-fit gap-1 rounded-full bg-surface p-1">
      {TABS.map(t => (
        <Link
          key={t.href}
          href={t.href}
          aria-current={t.href === current ? 'page' : undefined}
          className="inline-flex h-8 items-center rounded-full px-3 text-[13px] font-medium text-muted transition-colors hover:text-fg focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none aria-[current=page]:bg-card-raised aria-[current=page]:text-fg">
          {t.label}
        </Link>
      ))}
    </nav>
  )
}
