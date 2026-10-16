import type {Permission} from '@shop/shared/access'

export const NAV: {href: string; label: string; permission?: Permission}[] = [
  {href: '/', label: 'Home'},
  {href: '/catalog', label: 'Catalog'},
  {href: '/team', label: 'Team', permission: 'admin.invite'},
  {href: '/audit', label: 'Audit log', permission: 'audit.read'},
  {href: '/account', label: 'Account'}
]
