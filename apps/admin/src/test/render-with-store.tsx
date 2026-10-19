import {makeStore} from '@/lib/api/store'
import {type RenderResult, render} from '@testing-library/react'
import type {ReactElement} from 'react'
import {Provider} from 'react-redux'

import {TooltipProvider} from '@shop/ui/tooltip'

/** Renders with a fresh RTK Query store and the tooltip provider; stub the network with `jest.spyOn(global, 'fetch')`. */
export function renderWithStore(ui: ReactElement): RenderResult {
  return render(
    <Provider store={makeStore()}>
      <TooltipProvider>{ui}</TooltipProvider>
    </Provider>
  )
}
