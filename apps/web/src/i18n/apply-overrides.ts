import type {AbstractIntlMessages} from 'next-intl'

// The subpath keeps the ICU parser (ESM, used by the placeholder checks) out of the web bundle and jest.
import {isEditableKey} from '@shop/messages/editable'

/** File messages with admin overrides written in; unknown and non-editable keys are ignored (spec §6.3). */
export function applyOverrides(
  messages: AbstractIntlMessages,
  overrides: Record<string, string>
): AbstractIntlMessages {
  const out = structuredClone(messages)
  for (const [key, value] of Object.entries(overrides)) {
    if (!isEditableKey(key)) continue
    const path = key.split('.')
    let node: Record<string, unknown> = out
    for (const part of path.slice(0, -1)) {
      const next = node[part]
      if (typeof next !== 'object' || next === null) {
        node = {}
        break
      }
      node = next as Record<string, unknown>
    }
    const last = path.at(-1) ?? ''
    // Only an existing string is replaced: an orphan key never adds a text, and a namespace is never flattened.
    if (typeof node[last] === 'string') node[last] = value
  }
  return out
}
