import {makeStore} from '@/lib/api/store'
import {type RenderResult, render} from '@testing-library/react'
import type {ReactElement} from 'react'
import {Provider} from 'react-redux'

/** Renders with a fresh RTK Query store; stub the network with `jest.spyOn(global, 'fetch')`. */
export function renderWithStore(ui: ReactElement): RenderResult {
  return render(<Provider store={makeStore()}>{ui}</Provider>)
}
