import type {RulesSource} from '@/features/rules/types'

export const RULES_PL: RulesSource = {
  publishedAt: '2026-05-28T12:00:00Z',
  sections: [
    {
      id: 'general',
      title: 'Postanowienia ogólne',
      items: [
        {id: 'general-1', text: 'Nieznajomość zasad nie zwalnia z odpowiedzialności.'},
        {id: 'general-2', text: 'Dołączając do serwera, akceptujesz te zasady w całości.'},
        {
          id: 'general-3',
          text: 'Administracja może ukarać zachowanie szkodzące innym graczom, nawet jeśli żadna zasada go nie wymienia.'
        },
        {
          id: 'general-4',
          text: 'Zasady mogą się zmieniać; data wersji na górze strony pokazuje aktualne brzmienie.'
        }
      ]
    },
    {
      id: 'chat',
      title: 'Czat',
      items: [
        {id: 'chat-1', text: 'Szanuj innych. **Obelgi, groźby i mowa nienawiści** są zabronione.'},
        {id: 'chat-2', text: 'Zakaz spamu, floodu i pisania caps lockiem na czacie publicznym.'},
        {id: 'chat-3', text: 'Reklamowanie innych serwerów lub usług jest zabronione.'}
      ]
    },
    {
      id: 'account',
      title: 'Konto i nick',
      items: [
        {id: 'account-1', text: 'Odpowiadasz za wszystko, co dzieje się na Twoim koncie.'},
        {id: 'account-2', text: 'Nick nie może być obraźliwy ani podszywać się pod administrację.'},
        {id: 'account-3', text: 'Udostępnianie i sprzedaż kont są zabronione.'}
      ]
    },
    {
      id: 'gameplay',
      title: 'Rozgrywka',
      items: [
        {id: 'gameplay-1', text: 'Nie wykorzystuj błędów; zgłaszaj je administracji.'},
        {
          id: 'gameplay-2',
          text: 'Niszczenie cudzych budowli na chronionych terenach jest zabronione.'
        },
        {
          id: 'gameplay-3',
          text: 'Maszyny lagujące i budowle przeciążające serwer są usuwane bez ostrzeżenia.'
        },
        {id: 'gameplay-4', text: 'Oszustwa w handlu są karane jak kradzież.'},
        {id: 'gameplay-5', text: 'Budowanie w promieniu 50 bloków od spawnu jest zabronione.'}
      ]
    },
    {
      id: 'cheats',
      title: 'Sprawdzanie na cheaty',
      items: [
        {id: 'cheats-1', text: 'Zabronione są cheaty, makra i paczki zasobów typu *X-ray*.'},
        {
          id: 'cheats-2',
          text: 'Podczas sprawdzania musisz wykonywać polecenia administracji i pozostać online.'
        },
        {
          id: 'cheats-3',
          text: 'Odmowa sprawdzenia lub wyjście w jego trakcie oznacza przyznanie się do cheatowania.'
        },
        {
          id: 'cheats-4',
          text: '**Złośliwe oprogramowanie** wykryte na Twoim komputerze oznacza bana na stałe.'
        }
      ]
    },
    {
      id: 'paid',
      title: 'Usługi płatne',
      items: [
        {
          id: 'paid-1',
          text: 'Zakupy są dostarczane automatycznie; wyjątki opisuje [polityka zwrotów](/legal/refunds.pl.pdf).'
        },
        {id: 'paid-2', text: 'Płatne rangi nie zwalniają z przestrzegania zasad.'},
        {
          id: 'paid-3',
          text: 'Pytania o płatności zadawaj na naszym [Discordzie](https://discord.com).'
        }
      ]
    }
  ]
}
