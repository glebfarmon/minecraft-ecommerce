import {contrastRatio} from './contrast'

it('computes WCAG contrast ratios', () => {
  expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 0)
  expect(contrastRatio('#777777', '#777777')).toBeCloseTo(1, 5)
  expect(contrastRatio('#ffffff', '#ffc857')).toBeLessThan(4.5)
})
