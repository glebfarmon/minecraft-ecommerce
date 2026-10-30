/** Letters and digits without look-alikes: no `O`/`0`, no `I`/`1`. */
export const CODE_LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ'
export const CODE_DIGITS = '23456789'
/** Where the dice animation starts: the shape of a generated code. */
export const CODE_PLACEHOLDER = 'AAAAA000'

const LETTER_SLOTS = 5
const DIGIT_SLOTS = 3
export const CODE_LENGTH = LETTER_SLOTS + DIGIT_SLOTS

const pick = (alphabet: string, random: () => number) =>
  alphabet[Math.min(alphabet.length - 1, Math.floor(random() * alphabet.length))] ?? ''

/** A random character for one slot of a generated code: a letter for the first five, a digit after. */
export const slotChar = (slot: number, random: () => number = Math.random) =>
  pick(slot < LETTER_SLOTS ? CODE_LETTERS : CODE_DIGITS, random)

/** 5 letters + 3 digits, e.g. `BASFZ931`. */
export function generateCode(random: () => number = Math.random): string {
  return Array.from({length: CODE_LENGTH}, (_, slot) => slotChar(slot, random)).join('')
}
