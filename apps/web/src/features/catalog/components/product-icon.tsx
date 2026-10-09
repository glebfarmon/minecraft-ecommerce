import {Box, Coins, Crown, Pickaxe, Swords, Ticket} from 'lucide-react'
import type {LucideProps} from 'lucide-react'

import type {ProductIcon as IconName} from '@shop/shared/catalog'

const ICONS = {
  crown: Crown,
  box: Box,
  coins: Coins,
  swords: Swords,
  pickaxe: Pickaxe,
  ticket: Ticket
}

export function ProductIcon({name, ...props}: {name: IconName} & LucideProps) {
  const Icon = ICONS[name]
  return <Icon aria-hidden {...props} />
}
