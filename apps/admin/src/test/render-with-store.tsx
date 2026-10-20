import type {RenderResult} from '@testing-library/react'
import type {ReactElement} from 'react'

import {renderWithProviders} from './render-with-providers'

/** `renderWithProviders` with the defaults, for tests that only need the store. */
export function renderWithStore(ui: ReactElement): RenderResult {
  return renderWithProviders(ui)
}
