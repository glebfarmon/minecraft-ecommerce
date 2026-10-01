// Demo catalog. Every value here is placeholder data until the catalog API
// (sub-project 2) exists; the UI labels it as demo.

export type Currency = 'EUR' | 'PLN'
export type CategoryId = 'ranks' | 'cases' | 'currency' | 'kits'
export type ProductIcon = 'crown' | 'box' | 'coins' | 'swords' | 'pickaxe' | 'ticket'

export type Server = {
  slug: string
  name: string
  accent: string
  onAccent: string
  online: number | null
}

export type Product = {
  slug: string
  server: string
  category: CategoryId
  name: string
  /** Short wordmark printed on the tile. */
  mark: string
  icon: ProductIcon
  price: Record<Currency, number> // minor units
  durationDays?: number
  adult?: boolean
  description: {en: string; pl: string}
}

export const SERVER_IP = 'play.example.net'

export const servers: Server[] = [
  {slug: 'survival', name: 'Survival', accent: '#ff6b1a', onAccent: '#0e0e10', online: 31},
  {slug: 'anarchy', name: 'Anarchy', accent: '#7b3ff2', onAccent: '#ffffff', online: 14},
  {slug: 'minigames', name: 'Minigames', accent: '#d92b52', onAccent: '#ffffff', online: 22}
]

export const defaultServer: Server = servers[0] ?? {
  slug: 'survival',
  name: 'Survival',
  accent: '#ff6b1a',
  onAccent: '#0e0e10',
  online: null
}

export const categories: CategoryId[] = ['ranks', 'cases', 'currency', 'kits']

const p = (eur: number, pln: number) => ({EUR: eur, PLN: pln})

export const products: Product[] = [
  {
    slug: 'vip',
    server: 'survival',
    category: 'ranks',
    name: 'VIP',
    mark: 'VIP',
    icon: 'crown',
    price: p(499, 2199),
    durationDays: 30,
    description: {
      en: 'Coloured nickname, /hat, 2 extra homes and a VIP kit every 24 hours.',
      pl: 'Kolorowy nick, /hat, 2 dodatkowe domy i zestaw VIP co 24 godziny.'
    }
  },
  {
    slug: 'elite',
    server: 'survival',
    category: 'ranks',
    name: 'Elite',
    mark: 'ELITE',
    icon: 'crown',
    price: p(999, 4299),
    description: {
      en: 'Everything in VIP, plus /fly in your claims, 5 homes and a 10% shop discount.',
      pl: 'Wszystko z VIP, a do tego /fly na swoich działkach, 5 domów i 10% zniżki w sklepie.'
    }
  },
  {
    slug: 'legend',
    server: 'survival',
    category: 'ranks',
    name: 'Legend',
    mark: 'LEGEND',
    icon: 'crown',
    price: p(1999, 8599),
    description: {
      en: 'Everything in Elite, plus particle trails, 10 homes and a monthly Mythic case key.',
      pl: 'Wszystko z Elite, a do tego efekty cząsteczek, 10 domów i co miesiąc klucz do skrzynki Mythic.'
    }
  },
  {
    slug: 'mythic-case',
    server: 'survival',
    category: 'cases',
    name: 'Mythic case',
    mark: 'MYTHIC',
    icon: 'box',
    price: p(249, 1099),
    adult: true,
    description: {
      en: 'One key. Opens on the site with published odds you can verify yourself.',
      pl: 'Jeden klucz. Otwierasz go na stronie, a szanse są jawne i możesz je sprawdzić sam.'
    }
  },
  {
    slug: 'builder-case',
    server: 'survival',
    category: 'cases',
    name: 'Builder case',
    mark: 'BUILDER',
    icon: 'box',
    price: p(149, 649),
    adult: true,
    description: {
      en: 'Rare blocks and decor sets. Odds are published before you buy.',
      pl: 'Rzadkie bloki i zestawy dekoracji. Szanse są podane przed zakupem.'
    }
  },
  {
    slug: 'coins-1000',
    server: 'survival',
    category: 'currency',
    name: '1 000 coins',
    mark: '1000',
    icon: 'coins',
    price: p(299, 1299),
    description: {
      en: 'Credited to your balance as soon as the payment clears.',
      pl: 'Trafiają na Twoje saldo zaraz po zaksięgowaniu płatności.'
    }
  },
  {
    slug: 'coins-5000',
    server: 'survival',
    category: 'currency',
    name: '5 000 coins',
    mark: '5000',
    icon: 'coins',
    price: p(1199, 5199),
    description: {
      en: 'Five thousand coins, about 20% cheaper per coin than the small pack.',
      pl: 'Pięć tysięcy monet, około 20% taniej za monetę niż mały pakiet.'
    }
  },
  {
    slug: 'starter-kit',
    server: 'survival',
    category: 'kits',
    name: 'Starter kit',
    mark: 'START',
    icon: 'pickaxe',
    price: p(199, 899),
    description: {
      en: 'Iron tools, a stack of food and 32 torches for your first night.',
      pl: 'Żelazne narzędzia, stak jedzenia i 32 pochodnie na pierwszą noc.'
    }
  },
  {
    slug: 'nether-kit',
    server: 'survival',
    category: 'kits',
    name: 'Nether kit',
    mark: 'NETHER',
    icon: 'swords',
    price: p(349, 1499),
    description: {
      en: 'Fire resistance potions, gold armour and an obsidian stack.',
      pl: 'Mikstury odporności na ogień, złota zbroja i stak obsydianu.'
    }
  },
  {
    slug: 'raider',
    server: 'anarchy',
    category: 'ranks',
    name: 'Raider',
    mark: 'RAIDER',
    icon: 'crown',
    price: p(599, 2599),
    durationDays: 30,
    description: {
      en: 'Priority queue, coloured nickname and /kit raider once a day.',
      pl: 'Priorytet w kolejce, kolorowy nick i /kit raider raz dziennie.'
    }
  },
  {
    slug: 'warlord',
    server: 'anarchy',
    category: 'ranks',
    name: 'Warlord',
    mark: 'WARLORD',
    icon: 'crown',
    price: p(1299, 5599),
    description: {
      en: 'Everything in Raider, plus a reserved slot when the server is full.',
      pl: 'Wszystko z Raider, a do tego zarezerwowane miejsce, gdy serwer jest pełny.'
    }
  },
  {
    slug: 'chaos-case',
    server: 'anarchy',
    category: 'cases',
    name: 'Chaos case',
    mark: 'CHAOS',
    icon: 'box',
    price: p(299, 1299),
    adult: true,
    description: {
      en: 'Gear, shards or a rank. Published odds, provably fair.',
      pl: 'Sprzęt, odłamki albo ranga. Jawne szanse, uczciwość do sprawdzenia.'
    }
  },
  {
    slug: 'shards-2500',
    server: 'anarchy',
    category: 'currency',
    name: '2 500 shards',
    mark: '2500',
    icon: 'coins',
    price: p(499, 2199),
    description: {
      en: 'Shards for the black market. Credited instantly.',
      pl: 'Odłamki na czarny rynek. Dopisywane od razu.'
    }
  },
  {
    slug: 'pvp-kit',
    server: 'anarchy',
    category: 'kits',
    name: 'PvP kit',
    mark: 'PVP',
    icon: 'swords',
    price: p(399, 1699),
    description: {
      en: 'Diamond armour, a sharp sword and 16 golden apples.',
      pl: 'Diamentowa zbroja, ostry miecz i 16 złotych jabłek.'
    }
  },
  {
    slug: 'base-kit',
    server: 'anarchy',
    category: 'kits',
    name: 'Base kit',
    mark: 'BASE',
    icon: 'pickaxe',
    price: p(299, 1299),
    description: {
      en: 'Building blocks, chests and a bed to start a hidden base.',
      pl: 'Bloki, skrzynie i łóżko, żeby założyć ukrytą bazę.'
    }
  },
  {
    slug: 'pro',
    server: 'minigames',
    category: 'ranks',
    name: 'Pro',
    mark: 'PRO',
    icon: 'crown',
    price: p(399, 1699),
    description: {
      en: 'Double XP in every mode and a Pro badge in the lobby.',
      pl: 'Podwójne XP w każdym trybie i odznaka Pro w lobby.'
    }
  },
  {
    slug: 'champion',
    server: 'minigames',
    category: 'ranks',
    name: 'Champion',
    mark: 'CHAMP',
    icon: 'crown',
    price: p(799, 3499),
    description: {
      en: 'Everything in Pro, plus private games and map voting.',
      pl: 'Wszystko z Pro, a do tego prywatne gry i głosowanie na mapy.'
    }
  },
  {
    slug: 'season-pass',
    server: 'minigames',
    category: 'ranks',
    name: 'Season pass',
    mark: 'SEASON',
    icon: 'ticket',
    price: p(449, 1949),
    durationDays: 30,
    description: {
      en: 'Thirty days of season rewards and weekly challenges.',
      pl: 'Trzydzieści dni nagród sezonowych i cotygodniowych wyzwań.'
    }
  },
  {
    slug: 'cosmetic-case',
    server: 'minigames',
    category: 'cases',
    name: 'Cosmetic case',
    mark: 'STYLE',
    icon: 'box',
    price: p(199, 899),
    adult: true,
    description: {
      en: 'Hats, trails and win effects. Odds published before you buy.',
      pl: 'Czapki, ślady i efekty zwycięstwa. Szanse podane przed zakupem.'
    }
  },
  {
    slug: 'tokens-1000',
    server: 'minigames',
    category: 'currency',
    name: '1 000 tokens',
    mark: '1000',
    icon: 'coins',
    price: p(199, 899),
    description: {
      en: 'Tokens for cosmetics in the lobby shop.',
      pl: 'Żetony na kosmetyki w sklepie w lobby.'
    }
  }
]

export const networkOnline = servers.reduce((sum, s) => sum + (s.online ?? 0), 0)

export function findServer(slug: string) {
  return servers.find(s => s.slug === slug)
}

export function findProduct(server: string, slug: string) {
  return products.find(p => p.server === server && p.slug === slug)
}

export function formatPrice(minor: number, currency: Currency, locale: string) {
  return new Intl.NumberFormat(locale, {style: 'currency', currency}).format(minor / 100)
}

/** Prize table of the demo case shown in the fairness section (weights, not percents). */
export const demoPrizes = [
  {id: 1, name: '1 000 coins', weight: 600},
  {id: 2, name: 'VIP · 30 days', weight: 300},
  {id: 3, name: 'Elite', weight: 90},
  {id: 4, name: 'Legend', weight: 10}
]
