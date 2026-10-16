import type {RulesDocument} from '@shop/shared/rules'

/** Demo rules (EN + PL) seeded as the first published edition. */
export const DEMO_RULES: RulesDocument = {
  sections: [
    {
      id: 'general',
      title: {
        en: 'General',
        pl: 'Postanowienia ogólne'
      },
      items: [
        {
          id: 'general-1',
          text: {
            en: 'Not knowing the rules does not free you from responsibility.',
            pl: 'Nieznajomość zasad nie zwalnia z odpowiedzialności.'
          }
        },
        {
          id: 'general-2',
          text: {
            en: 'By joining the server you accept these rules in full.',
            pl: 'Dołączając do serwera, akceptujesz te zasady w całości.'
          }
        },
        {
          id: 'general-3',
          text: {
            en: 'Staff may punish behaviour that harms other players even if no rule names it.',
            pl: 'Administracja może ukarać zachowanie szkodzące innym graczom, nawet jeśli żadna zasada go nie wymienia.'
          }
        },
        {
          id: 'general-4',
          text: {
            en: 'Rules can change; the edition date at the top of this page shows the current version.',
            pl: 'Zasady mogą się zmieniać; data wersji na górze strony pokazuje aktualne brzmienie.'
          }
        }
      ]
    },
    {
      id: 'chat',
      title: {
        en: 'Chat',
        pl: 'Czat'
      },
      items: [
        {
          id: 'chat-1',
          text: {
            en: 'Be respectful. **Insults, threats and hate speech** are not allowed.',
            pl: 'Szanuj innych. **Obelgi, groźby i mowa nienawiści** są zabronione.'
          }
        },
        {
          id: 'chat-2',
          text: {
            en: 'No spam, flood or caps lock in public chat.',
            pl: 'Zakaz spamu, floodu i pisania caps lockiem na czacie publicznym.'
          }
        },
        {
          id: 'chat-3',
          text: {
            en: 'Advertising other servers or services is forbidden.',
            pl: 'Reklamowanie innych serwerów lub usług jest zabronione.'
          }
        }
      ]
    },
    {
      id: 'account',
      title: {
        en: 'Account and nickname',
        pl: 'Konto i nick'
      },
      items: [
        {
          id: 'account-1',
          text: {
            en: 'You are responsible for everything done from your account.',
            pl: 'Odpowiadasz za wszystko, co dzieje się na Twoim koncie.'
          }
        },
        {
          id: 'account-2',
          text: {
            en: 'Nicknames must not be offensive or imitate staff.',
            pl: 'Nick nie może być obraźliwy ani podszywać się pod administrację.'
          }
        },
        {
          id: 'account-3',
          text: {
            en: 'Sharing or selling accounts is not allowed.',
            pl: 'Udostępnianie i sprzedaż kont są zabronione.'
          }
        }
      ]
    },
    {
      id: 'gameplay',
      title: {
        en: 'Gameplay',
        pl: 'Rozgrywka'
      },
      items: [
        {
          id: 'gameplay-1',
          text: {
            en: 'Do not exploit bugs; report them to staff instead.',
            pl: 'Nie wykorzystuj błędów; zgłaszaj je administracji.'
          }
        },
        {
          id: 'gameplay-2',
          text: {
            en: 'Griefing in protected areas is forbidden.',
            pl: 'Niszczenie cudzych budowli na chronionych terenach jest zabronione.'
          }
        },
        {
          id: 'gameplay-3',
          text: {
            en: 'Lag machines and builds that overload the server are removed without warning.',
            pl: 'Maszyny lagujące i budowle przeciążające serwer są usuwane bez ostrzeżenia.'
          }
        },
        {
          id: 'gameplay-4',
          text: {
            en: 'Scamming in trades is punished like theft.',
            pl: 'Oszustwa w handlu są karane jak kradzież.'
          }
        },
        {
          id: 'gameplay-5',
          text: {
            en: 'Building within 50 blocks of spawn is not allowed.',
            pl: 'Budowanie w promieniu 50 bloków od spawnu jest zabronione.'
          }
        }
      ]
    },
    {
      id: 'cheats',
      title: {
        en: 'Cheat checks',
        pl: 'Sprawdzanie na cheaty'
      },
      items: [
        {
          id: 'cheats-1',
          text: {
            en: 'Cheat clients, macros and *X-ray* resource packs are forbidden.',
            pl: 'Zabronione są cheaty, makra i paczki zasobów typu *X-ray*.'
          }
        },
        {
          id: 'cheats-2',
          text: {
            en: 'During a check you must follow staff instructions and stay online.',
            pl: 'Podczas sprawdzania musisz wykonywać polecenia administracji i pozostać online.'
          }
        },
        {
          id: 'cheats-3',
          text: {
            en: 'Refusing a check or leaving during it counts as admitting to cheating.',
            pl: 'Odmowa sprawdzenia lub wyjście w jego trakcie oznacza przyznanie się do cheatowania.'
          }
        },
        {
          id: 'cheats-4',
          text: {
            en: '**Malicious software** found on your computer means a permanent ban.',
            pl: '**Złośliwe oprogramowanie** wykryte na Twoim komputerze oznacza bana na stałe.'
          }
        }
      ]
    },
    {
      id: 'paid',
      title: {
        en: 'Paid services',
        pl: 'Usługi płatne'
      },
      items: [
        {
          id: 'paid-1',
          text: {
            en: 'Purchases are delivered automatically; see the [refund policy](/legal/refunds.en.pdf) for exceptions.',
            pl: 'Zakupy są dostarczane automatycznie; wyjątki opisuje [polityka zwrotów](/legal/refunds.pl.pdf).'
          }
        },
        {
          id: 'paid-2',
          text: {
            en: 'Paid ranks do not exempt you from these rules.',
            pl: 'Płatne rangi nie zwalniają z przestrzegania zasad.'
          }
        },
        {
          id: 'paid-3',
          text: {
            en: 'Questions about payments go to our [Discord](https://discord.com).',
            pl: 'Pytania o płatności zadawaj na naszym [Discordzie](https://discord.com).'
          }
        }
      ]
    }
  ]
}

export const DEMO_RULES_PUBLISHED_AT = new Date('2026-05-28T12:00:00Z')
