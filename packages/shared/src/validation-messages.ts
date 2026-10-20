/**
 * The English text of every field message the shared schemas can produce, under a stable key. The API and the
 * storefront keep sending/showing the English text; the admin looks the key up (`validationKey`) to show its
 * own translation from `apps/admin/messages`.
 */
export const VALIDATION_MESSAGES = {
  ruleTextRequired: 'Enter the English text',
  safeLinks: 'Links must start with https:// or /',
  sectionIdsUnique: 'Section ids must be unique',
  itemIdsUnique: 'Item ids must be unique',
  idRepeated: 'An id appears twice',
  slugFormat: 'Use 1–40 lowercase letters, digits or dashes',
  hexColor: 'Use a hex color like #ff6b1a',
  onlyNickPlaceholder: 'Only the {nick} placeholder is allowed',
  commandTooLong: 'Use at most 200 characters per command',
  hostAndPortTogether: 'Set host and port together',
  enterName: 'Enter a name',
  enterEnglishName: 'Enter an English name',
  enterPolishName: 'Enter a Polish name',
  enterMark: 'Enter a mark',
  atMost12: 'Use at most 12 characters',
  atMost40: 'Use at most 40 characters',
  atMost60: 'Use at most 60 characters',
  atMost2000: 'Use at most 2000 characters',
  hostFormat: 'Use a host name or IP, optionally with :port',
  httpsLink: 'Use an https:// link',
  textRequired: 'Enter a text, or reset to use the default'
} as const

export type ValidationKey = keyof typeof VALIDATION_MESSAGES

const KEY_BY_MESSAGE = new Map<string, ValidationKey>(
  (Object.entries(VALIDATION_MESSAGES) as [ValidationKey, string][]).map(([key, message]) => [
    message,
    key
  ])
)

/** The key of an English schema message, or undefined for a message that is not one of ours. */
export const validationKey = (message: string): ValidationKey | undefined =>
  KEY_BY_MESSAGE.get(message)
