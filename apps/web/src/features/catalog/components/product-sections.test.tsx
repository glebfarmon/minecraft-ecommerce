import {fireEvent, render, screen, waitFor} from '@testing-library/react'

import {SectionBlock} from './product-sections'

jest.mock('next-intl', () => ({
  useTranslations: () => (key: string, values?: {cmd?: string}) =>
    values?.cmd ? `${key} ${values.cmd}` : key
}))

const section = {
  title: 'Kits',
  entries: [{cmd: '/kit legend', text: 'Diamond tools', cooldown: '24 h'}, {text: 'Plain perk'}]
}

describe('SectionBlock', () => {
  it('renders the title, explanation, cooldown and a plain line', () => {
    render(<SectionBlock section={section} />)
    expect(screen.getByRole('heading', {name: 'Kits'})).toBeTruthy()
    expect(screen.getByText('Diamond tools')).toBeTruthy()
    expect(screen.getByText('24 h')).toBeTruthy()
    expect(screen.getByText('Plain perk')).toBeTruthy()
  })

  it('copies a command to the clipboard on click', async () => {
    const writeText = jest.fn().mockResolvedValue(undefined)
    Object.assign(navigator, {clipboard: {writeText}})
    render(<SectionBlock section={section} />)
    fireEvent.click(screen.getByRole('button', {name: 'copyCommand /kit legend'}))
    expect(writeText).toHaveBeenCalledWith('/kit legend')
    await waitFor(() => {
      expect(screen.getByText('copied')).toBeTruthy()
    })
  })
})
