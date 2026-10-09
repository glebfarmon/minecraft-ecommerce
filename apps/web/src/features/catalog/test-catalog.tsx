// Test-only catalog in the API shape. Not imported by application code.
import {CatalogProvider} from '@/features/catalog/catalog-provider'
import {render} from '@testing-library/react'
import type {ReactElement} from 'react'

import type {CatalogResponse} from '@shop/shared/catalog'

export const TEST_CATALOG: CatalogResponse = {
  servers: [
    {
      slug: 'survival',
      name: 'Survival',
      accent: '#ff6b1a',
      onAccent: '#0e0e10',
      categories: [
        {slug: 'ranks', name: 'Ranks'},
        {slug: 'cases', name: 'Cases'},
        {slug: 'currency', name: 'Currency'},
        {slug: 'kits', name: 'Kits'}
      ]
    },
    {
      slug: 'anarchy',
      name: 'Anarchy',
      accent: '#7b3ff2',
      onAccent: '#ffffff',
      categories: [
        {slug: 'kits', name: 'Kits'},
        {slug: 'ranks', name: 'Ranks'}
      ]
    },
    {
      slug: 'minigames',
      name: 'Minigames',
      accent: '#d92b52',
      onAccent: '#ffffff',
      categories: [
        {slug: 'ranks', name: 'Ranks'},
        {slug: 'cosmetics', name: 'Cosmetics'}
      ]
    }
  ],
  products: [
    {
      server: 'survival',
      category: 'ranks',
      slug: 'vip',
      kind: 'TIMED',
      durationDays: 30,
      mark: 'VIP',
      icon: 'crown',
      name: 'VIP',
      description: 'Coloured nickname, /hat, 2 extra homes and a VIP kit every 24 hours.',
      sections: [],
      prices: {EUR: 499, PLN: 2199}
    },
    {
      server: 'survival',
      category: 'ranks',
      slug: 'legend',
      kind: 'PERMANENT',
      durationDays: null,
      mark: 'LEGEND',
      icon: 'crown',
      name: 'Legend',
      description: 'Everything in Elite, plus particle trails.',
      sections: [
        {
          title: 'Kits',
          entries: [
            {cmd: '/kit legend', text: 'Diamond tools', cooldown: '24 h'},
            {text: 'Gold prefix'}
          ]
        }
      ],
      prices: {EUR: 1999, PLN: 8599}
    },
    {
      server: 'survival',
      category: 'cases',
      slug: 'mythic-case',
      kind: 'CASE',
      durationDays: null,
      mark: 'MYTHIC',
      icon: 'box',
      name: 'Mythic case',
      description: 'One key. Opens on the site with published odds.',
      sections: [],
      prices: {EUR: 249, PLN: 1099}
    },
    {
      server: 'anarchy',
      category: 'kits',
      slug: 'pvp-kit',
      kind: 'PERMANENT',
      durationDays: null,
      mark: 'PVP',
      icon: 'swords',
      name: 'PvP kit',
      description: 'Netherite sword and armour.',
      sections: [],
      prices: {EUR: 399, PLN: 1699}
    },
    {
      server: 'minigames',
      category: 'ranks',
      slug: 'pro',
      kind: 'PERMANENT',
      durationDays: null,
      mark: 'PRO',
      icon: 'crown',
      name: 'Pro',
      description: 'Double XP in every mode.',
      sections: [],
      prices: {EUR: 399, PLN: 1699}
    }
  ]
}

export const renderWithCatalog = (
  ui: ReactElement,
  catalog: CatalogResponse | null = TEST_CATALOG
) => render(<CatalogProvider catalog={catalog}>{ui}</CatalogProvider>)
