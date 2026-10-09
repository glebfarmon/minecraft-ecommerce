import {render, screen} from '@testing-library/react'

import {RichText} from './rich-text'

describe('RichText', () => {
  it('renders bold, italic and links', () => {
    const {container} = render(
      <p>
        <RichText text="**No** *cheats*, ask on [Discord](https://discord.com)." />
      </p>
    )
    expect(container.querySelector('strong')).toHaveTextContent('No')
    expect(container.querySelector('em')).toHaveTextContent('cheats')
    const link = screen.getByRole('link', {name: 'Discord'})
    expect(link).toHaveAttribute('href', 'https://discord.com')
    expect(link).toHaveAttribute('target', '_blank')
    expect(link).toHaveAttribute('rel', 'noopener noreferrer')
  })

  it('opens site links in the same tab', () => {
    render(<RichText text="[refunds](/legal/refunds.en.pdf)" />)
    expect(screen.getByRole('link', {name: 'refunds'})).not.toHaveAttribute('target')
  })

  it('never renders HTML from the text', () => {
    const {container} = render(<RichText text="<img src=x onerror=alert(1)>" />)
    expect(container.querySelector('img')).toBeNull()
    expect(container).toHaveTextContent('<img src=x onerror=alert(1)>')
  })

  it('passes every text run through mark', () => {
    const {container} = render(
      <RichText text="**Bold** rest" mark={value => <i data-marked>{value}</i>} />
    )
    expect(container.querySelectorAll('[data-marked]')).toHaveLength(2)
  })
})
