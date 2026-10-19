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

  it('renders underline', () => {
    const {container} = render(<RichText text="a ++b++" />)
    expect(container.querySelector('u')).toHaveTextContent('b')
  })

  it('renders bold inside italic', () => {
    const {container} = render(<RichText text="*one **two***" />)
    expect(container.querySelector('em strong')).toHaveTextContent('two')
  })

  it('highlights a match inside nested marks', () => {
    const {container} = render(
      <RichText text="**a *b***" mark={value => <i data-marked>{value}</i>} />
    )
    expect(container.querySelector('strong em [data-marked]')).toHaveTextContent('b')
  })

  it('leaves links literal when links is false', () => {
    render(<RichText text="[x](/a)" links={false} />)
    expect(screen.queryByRole('link')).toBeNull()
    expect(screen.getByText('[x](/a)')).toBeInTheDocument()
  })
})
