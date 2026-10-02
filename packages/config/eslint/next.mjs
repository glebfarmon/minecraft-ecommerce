import nextVitals from 'eslint-config-next/core-web-vitals'
import {defineConfig} from 'eslint/config'

import {base} from './base.mjs'

// Layer direction: shared (components, hooks, lib, i18n) -> features -> app + store.
// See docs/adr/0004-frontend-structure.md.
export const next = defineConfig(
  base,
  nextVitals,
  {
    files: ['src/config/**', 'src/components/**', 'src/hooks/**', 'src/lib/**', 'src/i18n/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/features/**', '**/app/**', '**/store/**'],
              message: 'Shared code must not import features, app or store (ADR 0004).'
            }
          ]
        }
      ]
    }
  },
  {
    files: ['src/features/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/app/**', '**/store/**', '!**/store/hooks'],
              message: 'Features must not import app or store, except store/hooks (ADR 0004).'
            }
          ]
        }
      ]
    }
  }
)
