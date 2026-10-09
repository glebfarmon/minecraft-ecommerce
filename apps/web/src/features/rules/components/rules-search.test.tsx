import {fireEvent, render, screen} from '@testing-library/react'

import {RulesSearch} from './rules-search'

jest.mock('next-intl', () => ({useTranslations: () => (key: string) => key}))

const box = () => screen.getByRole('searchbox', {name: 'searchLabel'})

describe('RulesSearch', () => {
  it('focuses on "/"', () => {
    render(<RulesSearch query="" onQueryChange={jest.fn()} />)
    fireEvent.keyDown(document.body, {key: '/'})
    expect(box()).toHaveFocus()
  })

  it('leaves "/" alone while typing in another field', () => {
    render(
      <>
        <input aria-label="other" />
        <RulesSearch query="" onQueryChange={jest.fn()} />
      </>
    )
    const other = screen.getByRole('textbox', {name: 'other'})
    other.focus()
    fireEvent.keyDown(other, {key: '/'})
    expect(other).toHaveFocus()
  })

  it.each([{ctrlKey: true}, {metaKey: true}, {altKey: true}])(
    'leaves "/" with a modifier to the browser (%o)',
    modifier => {
      render(<RulesSearch query="" onQueryChange={jest.fn()} />)
      fireEvent.keyDown(document.body, {key: '/', ...modifier})
      expect(box()).not.toHaveFocus()
    }
  )

  it('reports typing', () => {
    const onQueryChange = jest.fn()
    render(<RulesSearch query="" onQueryChange={onQueryChange} />)
    fireEvent.change(box(), {target: {value: 'chat'}})
    expect(onQueryChange).toHaveBeenCalledWith('chat')
  })

  it('clears and refocuses', () => {
    const onQueryChange = jest.fn()
    render(<RulesSearch query="chat" onQueryChange={onQueryChange} />)
    fireEvent.click(screen.getByRole('button', {name: 'clearSearch'}))
    expect(onQueryChange).toHaveBeenCalledWith('')
    expect(box()).toHaveFocus()
  })
})
