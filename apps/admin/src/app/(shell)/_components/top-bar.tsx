import {type Me, hasPermission} from '@shop/shared/access'

import {GlobalSearch} from './global-search'
import {MobileNav} from './mobile-nav'

export function TopBar({me}: {me: Me}) {
  return (
    <header className="mb-4 flex h-14 items-center gap-3">
      <MobileNav me={me} />
      {hasPermission(me.permissions, 'order.read') && <GlobalSearch />}
      <p className="ml-auto hidden text-sm text-muted sm:block">
        {me.email} · {me.role.name}
      </p>
    </header>
  )
}
