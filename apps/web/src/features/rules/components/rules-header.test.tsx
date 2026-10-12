import {render, screen} from '@testing-library/react'
import {renderToString} from 'react-dom/server'

import {RulesHeader} from './rules-header'

const props = {
  title: 'Zasady <accent>serwera</accent>',
  lead: 'Grając na naszych serwerach…',
  edition: 'Obowiązująca wersja z 28 maja 2026'
}

describe('RulesHeader', () => {
  it('reads as one heading, with the accent word coloured', () => {
    render(<RulesHeader {...props} />)
    expect(screen.getByRole('heading', {level: 1, name: 'Zasady serwera'})).toBeInTheDocument()
    expect(screen.getByText('serwera')).toHaveClass('text-accent')
    expect(screen.getByText(props.lead)).toBeInTheDocument()
    expect(screen.getByText(props.edition)).toBeInTheDocument()
  })

  it('ships each title word below its mask in the server HTML, like the home hero', () => {
    const html = renderToString(<RulesHeader {...props} />)
    expect(html.match(/transform:translateY\(110%\)/g)).toHaveLength(2)
  })

  it('leaves out the edition line when there is none', () => {
    render(<RulesHeader {...props} edition={null} />)
    expect(screen.queryByText(/Obowiązująca/)).not.toBeInTheDocument()
  })
})
