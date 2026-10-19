import {render, screen} from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import {TooltipProvider} from '@shop/ui/tooltip'

import {Hint} from './hint'

describe('Hint', () => {
  it('shows its label on keyboard focus', async () => {
    const user = userEvent.setup()
    render(
      <TooltipProvider>
        <Hint label="Orders">
          <button type="button">x</button>
        </Hint>
      </TooltipProvider>
    )
    await user.tab()
    expect(await screen.findByRole('tooltip')).toHaveTextContent('Orders')
  })
})
