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
  label: string
  icon: LucideIcon
  permission?: Permission
  match?: string
}[] = [
  {href: '/', label: 'Home', icon: LayoutGrid},
  {href: '/orders', label: 'Orders', icon: ReceiptText, permission: 'order.read'},
  {href: '/catalog', label: 'Catalog', icon: Boxes},
  {
    href: '/content/rules',
    label: 'Content',
    icon: FileText,
    permission: 'content.write',
    match: '/content'
  },
  {href: '/team', label: 'Team', icon: Users, permission: 'admin.invite'},
  {href: '/audit', label: 'Audit log', icon: ScrollText, permission: 'audit.read'},
  {href: '/account', label: 'Account', icon: UserRound}
]
