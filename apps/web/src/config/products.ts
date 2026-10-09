// Demo catalog. Every value here is placeholder data until the catalog API
// (sub-project 2) exists; the UI labels it as demo.
import type {Currency} from '@/config/currencies'
import type {CategoryId} from '@/config/servers'
import type {Locale} from '@/i18n/routing'

export type ProductIcon = 'crown' | 'box' | 'coins' | 'swords' | 'pickaxe' | 'ticket'

/** One line of a description section: an optional copyable command, an explanation, an optional cooldown tag. */
export type Entry = {cmd?: string; text?: string; cooldown?: string}
export type Section = {title: string; entries: Entry[]}

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
  /** Short intro shown first in the description. */
  description: Record<Locale, string>
  /** Full description as titled blocks (commands, limits, perks). */
  sections?: Record<Locale, Section[]>
}

const e = (cmd: string, text: string, cooldown?: string): Entry =>
  cooldown ? {cmd, text, cooldown} : {cmd, text}
const note = (text: string): Entry => ({text})

const legendSections: Record<Locale, Section[]> = {
  en: [
    {
      title: 'Chat and tab list',
      entries: [
        note('Gold [Legend] prefix in chat and in the tab list'),
        e('/nick <name>', 'Coloured nickname: 12 colours and gradients'),
        note('Your name is bold in the tab list and above your head')
      ]
    },
    {
      title: 'Kits',
      entries: [
        e('/kit legend', 'Diamond tools, 32 golden carrots, 16 experience bottles', '24 h'),
        e('/kit legend-tools', 'Pickaxe, axe and shovel with Efficiency V, Unbreaking III', '7 d'),
        e('/kit legend-food', '64 cooked steak, 16 golden apples', '12 h'),
        e('/kit legend-start', 'Elytra, 64 fireworks, 2 shulker boxes', 'once a season')
      ]
    },
    {
      title: 'Utility commands',
      entries: [
        e('/enchant', 'Enchant the item in your hand up to level 30, free', '6 h'),
        e('/anvil', 'Portable anvil with no repair cost limit'),
        e('/ec', 'Ender chest from anywhere'),
        e('/craft', 'Portable crafting table'),
        e('/hat', 'Wear any block as a hat'),
        e('/feed', 'Refill hunger', '10 min'),
        e('/heal', 'Refill health', '30 min'),
        e('/repair hand', 'Repair the item in your hand', '2 h'),
        e('/repair all', 'Repair your whole inventory', '12 h')
      ]
    },
    {
      title: 'Movement',
      entries: [
        e('/fly', 'Flight in your claims and at spawn'),
        e('/speed <1-5>', 'Walk and fly speed'),
        e('/back', 'Return to your last location or death point'),
        e('/tpa <player>', 'Teleport request with no delay'),
        e('/rtp', 'Random teleport', '5 min')
      ]
    },
    {
      title: 'Economy',
      entries: [
        e('/salary', 'Collect 5,000 coins', '3 h'),
        e('/exp', 'Claim 1,500 free experience points', '24 h'),
        e('/sell all', 'Sell items from anywhere at a +10% price'),
        e('/pay <player> <amount>', 'Send coins, no fee')
      ]
    },
    {
      title: 'Homes',
      entries: [
        note('Up to 10 homes, teleport with no warm-up delay'),
        e('/sethome <name>', 'Set a home'),
        e('/home <name>', 'Teleport to a home'),
        e('/homes', 'List your homes'),
        e('/delhome <name>', 'Remove a home')
      ]
    },
    {
      title: 'Land claims',
      entries: [
        note('Up to 6 regions, 40,000 blocks of claimed area in total'),
        e('/claim', 'Create a region from your selection'),
        e('/unclaim', 'Remove a region'),
        e('/trust <player>', 'Let a friend build; /untrust takes it back'),
        e('/claimlist', 'List your regions with their size'),
        note('Regions are protected from griefing, creepers and fire')
      ]
    },
    {
      title: 'Auction and shop',
      entries: [
        note('3 auction slots, 48 hours per listing'),
        note('2% auction fee instead of 5%'),
        note('15% off every item in the shop')
      ]
    },
    {
      title: 'Other perks',
      entries: [
        note('Join a full server through the priority queue'),
        note('Keep your inventory in the hardcore event'),
        note('Access to the Legend lounge at spawn'),
        note('A Mythic case key on the 1st of every month')
      ]
    },
    {
      title: 'Good to know',
      entries: [
        note('The rank is permanent and does not expire. It applies to the Survival server only.'),
        note(
          'Permissions apply within seconds after payment. If a command does not work yet, rejoin the server.'
        )
      ]
    }
  ],
  pl: [
    {
      title: 'Czat i tab',
      entries: [
        note('Złoty prefiks [Legend] na czacie i w tabie'),
        e('/nick <nazwa>', 'Kolorowy nick: 12 kolorów i gradienty'),
        note('Twój nick jest pogrubiony w tabie i nad głową')
      ]
    },
    {
      title: 'Zestawy',
      entries: [
        e(
          '/kit legend',
          'Diamentowe narzędzia, 32 złote marchewki, 16 butelek doświadczenia',
          '24 h'
        ),
        e(
          '/kit legend-tools',
          'Kilof, siekiera i łopata z Efektywnością V, Niezniszczalnością III',
          '7 d'
        ),
        e('/kit legend-food', '64 pieczone steki, 16 złotych jabłek', '12 h'),
        e('/kit legend-start', 'Elytry, 64 fajerwerki, 2 skrzynie shulkera', 'raz na sezon')
      ]
    },
    {
      title: 'Komendy użytkowe',
      entries: [
        e('/enchant', 'Zaklnij przedmiot w ręce do poziomu 30, za darmo', '6 h'),
        e('/anvil', 'Przenośne kowadło bez limitu kosztu naprawy'),
        e('/ec', 'Skrzynia Endu z dowolnego miejsca'),
        e('/craft', 'Przenośny stół rzemieślniczy'),
        e('/hat', 'Załóż dowolny blok jako czapkę'),
        e('/feed', 'Uzupełnij głód', '10 min'),
        e('/heal', 'Uzupełnij zdrowie', '30 min'),
        e('/repair hand', 'Napraw przedmiot w ręce', '2 h'),
        e('/repair all', 'Napraw cały ekwipunek', '12 h')
      ]
    },
    {
      title: 'Poruszanie się',
      entries: [
        e('/fly', 'Latanie na swoich działkach i na spawnie'),
        e('/speed <1-5>', 'Prędkość chodzenia i latania'),
        e('/back', 'Powrót do ostatniej lokalizacji lub miejsca śmierci'),
        e('/tpa <gracz>', 'Prośba o teleport bez opóźnienia'),
        e('/rtp', 'Losowy teleport', '5 min')
      ]
    },
    {
      title: 'Ekonomia',
      entries: [
        e('/salary', 'Odbierz 5 000 monet', '3 h'),
        e('/exp', 'Odbierz 1 500 punktów doświadczenia za darmo', '24 h'),
        e('/sell all', 'Sprzedawaj z dowolnego miejsca, cena +10%'),
        e('/pay <gracz> <kwota>', 'Wyślij monety, bez prowizji')
      ]
    },
    {
      title: 'Domy',
      entries: [
        note('Do 10 domów, teleport bez czasu oczekiwania'),
        e('/sethome <nazwa>', 'Ustaw dom'),
        e('/home <nazwa>', 'Teleport do domu'),
        e('/homes', 'Lista Twoich domów'),
        e('/delhome <nazwa>', 'Usuń dom')
      ]
    },
    {
      title: 'Działki',
      entries: [
        note('Do 6 regionów, łącznie 40 000 bloków chronionego terenu'),
        e('/claim', 'Utwórz region z zaznaczenia'),
        e('/unclaim', 'Usuń region'),
        e('/trust <gracz>', 'Pozwól znajomemu budować; /untrust cofa dostęp'),
        e('/claimlist', 'Lista Twoich regionów z rozmiarem'),
        note('Regiony są chronione przed griefingiem, creeperami i ogniem')
      ]
    },
    {
      title: 'Aukcja i sklep',
      entries: [
        note('3 miejsca na aukcji, 48 godzin na ofertę'),
        note('Prowizja aukcji 2% zamiast 5%'),
        note('15% zniżki na każdy przedmiot w sklepie')
      ]
    },
    {
      title: 'Pozostałe dodatki',
      entries: [
        note('Wejście na pełny serwer przez kolejkę priorytetową'),
        note('Zachowanie ekwipunku w evencie hardcore'),
        note('Dostęp do salonu Legend na spawnie'),
        note('Klucz do skrzynki Mythic 1. dnia każdego miesiąca')
      ]
    },
    {
      title: 'Warto wiedzieć',
      entries: [
        note('Ranga jest stała i nie wygasa. Działa tylko na serwerze Survival.'),
        note(
          'Uprawnienia są nadawane w kilka sekund po płatności. Jeśli komenda jeszcze nie działa, wejdź na serwer ponownie.'
        )
      ]
    }
  ]
}

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
    },
    sections: legendSections
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

/** Prize table of the demo case shown in the fairness section (weights, not percents). */
export const demoPrizes = [
  {id: 1, name: '1 000 coins', weight: 600},
  {id: 2, name: 'VIP · 30 days', weight: 300},
  {id: 3, name: 'Elite', weight: 90},
  {id: 4, name: 'Legend', weight: 10}
]
