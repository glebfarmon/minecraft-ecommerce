import {PUBLIC_ID_PATTERN} from '@shop/shared/orders'

import {newPublicId} from './public-id'

it('makes 1000 distinct ids that match the public pattern', () => {
  const ids = Array.from({length: 1000}, () => newPublicId())
  expect(ids.every(id => PUBLIC_ID_PATTERN.test(id))).toBe(true)
  expect(new Set(ids).size).toBe(1000)
})
