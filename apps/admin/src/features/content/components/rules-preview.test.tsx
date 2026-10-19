import {render as rtlRender, screen, within} from '@testing-library/react'
import type {ReactElement} from 'react'

import type {RulesDocument} from '@shop/shared/rules'
import {TooltipProvider} from '@shop/ui/tooltip'

import {RulesPreview} from './rules-preview'

const render = (ui: ReactElement) => rtlRender(ui, {wrapper: TooltipProvider})

const content: RulesDocument = {
  sections: [
    {
      id: 'general',
      title: {en: 'General', pl: 'Ogólne'},
      items: [
        {id: 'general-1', text: {en: 'Be kind.', pl: 'Bądź miły.'}},
        {id: 'general-2', text: {en: 'No cheating.'}}
      ]
    },
    {id: 'chat', title: {en: 'Chat'}, items: [{id: 'chat-1', text: {en: 'No spam.', pl: ''}}]}
  ]
}

describe('RulesPreview', () => {
  it('numbers sections and items and falls back to EN in the PL view', () => {
    const {rerender} = render(<RulesPreview content={content} locale="en" />)
    const preview = screen.getByRole('region', {name: 'Preview'})
    expect(within(preview).getByRole('heading', {name: '1. General'})).toBeInTheDocument()
    expect(within(preview).getByRole('heading', {name: '2. Chat'})).toBeInTheDocument()
    expect(within(preview).getByText('1.1')).toBeInTheDocument()
    expect(within(preview).getByText('1.2')).toBeInTheDocument()
    expect(within(preview).getByText('2.1')).toBeInTheDocument()
    expect(within(preview).getByText('Be kind.')).toBeInTheDocument()

    rerender(<RulesPreview content={content} locale="pl" />)
    expect(within(preview).getByRole('heading', {name: '1. Ogólne'})).toBeInTheDocument()
    expect(within(preview).getByText('Bądź miły.')).toBeInTheDocument()
    expect(within(preview).queryByText('Be kind.')).not.toBeInTheDocument()
    // No PL text (missing or empty): the English one, as on the site.
    expect(within(preview).getByRole('heading', {name: /^2\. Chat/})).toBeInTheDocument()
    expect(within(preview).getByText('No cheating.')).toBeInTheDocument()
    expect(within(preview).getByText('No spam.')).toBeInTheDocument()
    expect(within(preview).getAllByLabelText('EN: Uses the English text')).toHaveLength(3)
  })

  it('has no language toggle of its own', () => {
    render(<RulesPreview content={content} locale="en" />)
    expect(screen.queryByRole('group', {name: 'Preview language'})).not.toBeInTheDocument()
  })

  it('renders [x](javascript:…) as plain text', () => {
    render(
      <RulesPreview
        locale="en"
        content={{
          sections: [
            {
              id: 'links',
              title: {en: 'Links'},
              items: [
                {id: 'links-1', text: {en: 'Click [x](javascript:void) or [docs](/faq).'}},
                {id: 'links-2', text: {en: '**Bold** and *italic*'}}
              ]
            }
          ]
        }}
      />
    )
    const preview = screen.getByRole('region', {name: 'Preview'})
    const links = within(preview).getAllByRole('link')
    expect(links).toHaveLength(1)
    expect(links[0]).toHaveAttribute('href', '/faq')
    // The label stays in the sentence as plain text, not as a link.
    expect(within(preview).getByText(/^Click x or/)).toBeInTheDocument()
    expect(preview.innerHTML).not.toContain('javascript:')
    expect(within(preview).getByText('Bold').tagName).toBe('STRONG')
    expect(within(preview).getByText('italic').tagName).toBe('EM')
  })
})
