import {VALIDATION_MESSAGES} from '@shop/shared/validation-messages'

/**
 * English text of the messages only the admin's own form schemas produce. Shared ones stay in
 * `@shop/shared/validation-messages`; both sets are translated under `validation.<key>` in `messages/`.
 */
export const FORM_MESSAGES = {
  sixDigits: 'Enter the 6 digits',
  backupCode: 'Enter a backup code',
  priceFormat: 'Use a price like 9.99',
  timedDays: 'TIMED products need a number of days; other kinds leave it empty',
  chooseServer: 'Choose a server',
  chooseCategory: 'Choose a category',
  portRange: 'Use a port between 1 and 65535',
  roleNameLength: 'Use 2 to 40 characters',
  promoCodeFormat: 'Use 3–32 letters or digits',
  percentRange: 'Use a whole percent from 1 to 100',
  amountFormat: 'Use an amount above zero, like 5.00',
  maxUsesFormat: 'Use a whole number from 1, or leave empty for unlimited',
  endAfterStart: 'The end must be after the start'
} as const

const ALL: Record<string, string> = {...VALIDATION_MESSAGES, ...FORM_MESSAGES}
const KEY_BY_MESSAGE = new Map(Object.entries(ALL).map(([key, message]) => [message, key]))

/** The `validation.<key>` of an English schema message, or undefined for text that is not one of ours. */
export const messageKey = (message: string): string | undefined => KEY_BY_MESSAGE.get(message)
