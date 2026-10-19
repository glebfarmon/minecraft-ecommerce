import {brandInitial} from './brand'

describe('brandInitial', () => {
  it('is the first letter of the site name', () => {
    expect(brandInitial({plain: 'Block', accent: 'haus'})).toBe('B')
  })
  it('upper-cases it and skips leading spaces', () => {
    expect(brandInitial({plain: ' ', accent: 'craft'})).toBe('C')
  })
  it('is ? for an empty name', () => {
    expect(brandInitial({plain: '', accent: ''})).toBe('?')
  })
})
