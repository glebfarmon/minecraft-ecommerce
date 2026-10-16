import type {Permission} from '@shop/shared/access'

export const NAV: {href: string; label: string; permission?: Permission; match?: string}[] = [
  {href: '/', label: 'Home'},
  {href: '/catalog', label: 'Catalog'},
  {href: '/content/rules', label: 'Content', permission: 'content.write', match: '/content'},
  {href: '/team', label: 'Team', permission: 'admin.invite'},
  {href: '/audit', label: 'Audit log', permission: 'audit.read'},
  {href: '/account', label: 'Account'}
]
