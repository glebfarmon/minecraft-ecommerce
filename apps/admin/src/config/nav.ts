import {
  Boxes,
  FileText,
  LayoutGrid,
  type LucideIcon,
  ReceiptText,
  ScrollText,
  UserRound,
  Users
} from 'lucide-react'

import type {Permission} from '@shop/shared/access'

export const NAV: {
  href: string
  key: 'home' | 'orders' | 'catalog' | 'content' | 'team' | 'audit' | 'account'
  icon: LucideIcon
  permission?: Permission
  match?: string
}[] = [
  {href: '/', key: 'home', icon: LayoutGrid},
  {href: '/orders', key: 'orders', icon: ReceiptText, permission: 'order.read'},
  {href: '/catalog', key: 'catalog', icon: Boxes},
  {
    href: '/content/rules',
    key: 'content',
    icon: FileText,
    permission: 'content.write',
    match: '/content'
  },
  {href: '/team', key: 'team', icon: Users, permission: 'admin.invite'},
  {href: '/audit', key: 'audit', icon: ScrollText, permission: 'audit.read'},
  {href: '/account', key: 'account', icon: UserRound}
]
