import type {RulesSource} from '@/features/rules/types'

// Demo rules until the content API exists (spec §9, phase 2 seeds them as the first published version).
export const RULES_EN: RulesSource = {
  publishedAt: '2026-05-28T12:00:00Z',
  sections: [
    {
      id: 'general',
      title: 'General',
      items: [
        {id: 'general-1', text: 'Not knowing the rules does not free you from responsibility.'},
        {id: 'general-2', text: 'By joining the server you accept these rules in full.'},
        {
          id: 'general-3',
          text: 'Staff may punish behaviour that harms other players even if no rule names it.'
        },
        {
          id: 'general-4',
          text: 'Rules can change; the edition date at the top of this page shows the current version.'
        }
      ]
    },
    {
      id: 'chat',
      title: 'Chat',
      items: [
        {
          id: 'chat-1',
          text: 'Be respectful. **Insults, threats and hate speech** are not allowed.'
        },
        {id: 'chat-2', text: 'No spam, flood or caps lock in public chat.'},
        {id: 'chat-3', text: 'Advertising other servers or services is forbidden.'}
      ]
    },
    {
      id: 'account',
      title: 'Account and nickname',
      items: [
        {id: 'account-1', text: 'You are responsible for everything done from your account.'},
        {id: 'account-2', text: 'Nicknames must not be offensive or imitate staff.'},
        {id: 'account-3', text: 'Sharing or selling accounts is not allowed.'}
      ]
    },
    {
      id: 'gameplay',
      title: 'Gameplay',
      items: [
        {id: 'gameplay-1', text: 'Do not exploit bugs; report them to staff instead.'},
        {id: 'gameplay-2', text: 'Griefing in protected areas is forbidden.'},
        {
          id: 'gameplay-3',
          text: 'Lag machines and builds that overload the server are removed without warning.'
        },
        {id: 'gameplay-4', text: 'Scamming in trades is punished like theft.'},
        {id: 'gameplay-5', text: 'Building within 50 blocks of spawn is not allowed.'}
      ]
    },
    {
      id: 'cheats',
      title: 'Cheat checks',
      items: [
        {id: 'cheats-1', text: 'Cheat clients, macros and *X-ray* resource packs are forbidden.'},
        {
          id: 'cheats-2',
          text: 'During a check you must follow staff instructions and stay online.'
        },
        {
          id: 'cheats-3',
          text: 'Refusing a check or leaving during it counts as admitting to cheating.'
        },
        {
          id: 'cheats-4',
          text: '**Malicious software** found on your computer means a permanent ban.'
        }
      ]
    },
    {
      id: 'paid',
      title: 'Paid services',
      items: [
        {
          id: 'paid-1',
          text: 'Purchases are delivered automatically; see the [refund policy](/legal/refunds.en.pdf) for exceptions.'
        },
        {id: 'paid-2', text: 'Paid ranks do not exempt you from these rules.'},
        {id: 'paid-3', text: 'Questions about payments go to our [Discord](https://discord.com).'}
      ]
    }
  ]
}
