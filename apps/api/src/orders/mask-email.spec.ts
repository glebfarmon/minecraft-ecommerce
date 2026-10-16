import {maskEmail} from './mask-email'

it.each([
  ['steve@example.com', 's***@example.com'],
  ['a@example.com', '*@example.com'],
  ['Ab.Cd@sub.example.pl', 'A***@sub.example.pl']
])('%s → %s', (input, out) => {
  expect(maskEmail(input)).toBe(out)
})
