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
    <nav aria-label="Content" className="flex gap-1">
      {TABS.map(t => (
        <Link
          key={t.href}
          href={t.href}
          aria-current={t.href === current ? 'page' : undefined}
          className="text-muted-foreground rounded-md px-3 py-1 text-sm hover:bg-accent hover:text-foreground aria-[current=page]:bg-accent aria-[current=page]:text-foreground">
          {t.label}
        </Link>
      ))}
    </nav>
  )
}
