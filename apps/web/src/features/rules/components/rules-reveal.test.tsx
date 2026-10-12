import {render, screen} from '@testing-library/react'

import {RulesReveal} from './rules-reveal'

describe('RulesReveal', () => {
  it('starts hidden for the page entrance', () => {
    render(
      <RulesReveal delay={0}>
        <p>rule</p>
      </RulesReveal>
    )
    expect(screen.getByText('rule').parentElement).toHaveStyle({opacity: '0'})
  })

  it('shows at once when the entrance is over (e.g. a section returning after a search)', () => {
    render(
      <RulesReveal delay={0} intro={false}>
        <p>rule</p>
      </RulesReveal>
    )
    expect(screen.getByText('rule').parentElement).not.toHaveStyle({opacity: '0'})
  })
})
