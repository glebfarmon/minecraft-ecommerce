import {act, fireEvent, render, screen} from '@testing-library/react'

import {RuleActions} from './rule-actions'

// next-intl is ESM-only; "key number" stands in for the translated text.
jest.mock('next-intl', () => ({
  useTranslations: () => (key: string, values?: {number?: string}) =>
    values?.number ? `${key} ${values.number}` : key
}))

const writeText = jest.fn()

beforeEach(() => {
  writeText.mockReset().mockResolvedValue(undefined)
  Object.defineProperty(navigator, 'clipboard', {value: {writeText}, configurable: true})
})

const status = () => screen.getByRole('status')

/** Click, then let the clipboard promise settle. */
const click = async (name: string) => {
  fireEvent.click(screen.getByRole('button', {name}))
  await act(() => Promise.resolve())
}

describe('RuleActions', () => {
  it('copies "number. plain text"', async () => {
    render(<RuleActions number="2.3" plainText="No spam." href="/pl/rules#r-2-3" />)
    await click('copyText 2.3')
    expect(writeText).toHaveBeenCalledWith('2.3. No spam.')
    expect(status()).toHaveTextContent('copied')
  })

  it.each([
    ['/rules#r-2-3', 'http://localhost/rules#r-2-3'],
    ['/pl/rules#r-2-3', 'http://localhost/pl/rules#r-2-3']
  ])('copies the absolute link for %s', async (href, url) => {
    render(<RuleActions number="2.3" plainText="No spam." href={href} />)
    await click('copyLink 2.3')
    expect(writeText).toHaveBeenCalledWith(url)
    expect(status()).toHaveTextContent('linkCopied')
  })

  it('announces a failure when the clipboard rejects', async () => {
    writeText.mockRejectedValue(new Error('denied'))
    render(<RuleActions number="2.3" plainText="No spam." href="/rules#r-2-3" />)
    await click('copyText 2.3')
    expect(status()).toHaveTextContent('copyFailed')
  })

  it('announces a failure when there is no clipboard (plain http)', async () => {
    Object.defineProperty(navigator, 'clipboard', {value: undefined, configurable: true})
    render(<RuleActions number="2.3" plainText="No spam." href="/rules#r-2-3" />)
    await click('copyLink 2.3')
    expect(status()).toHaveTextContent('copyFailed')
  })

  it('clears the announcement after the flash', async () => {
    jest.useFakeTimers()
    render(<RuleActions number="2.3" plainText="No spam." href="/rules#r-2-3" />)
    await click('copyText 2.3')
    act(() => {
      jest.advanceTimersByTime(1500)
    })
    expect(status()).toHaveTextContent('')
    jest.useRealTimers()
  })
})
