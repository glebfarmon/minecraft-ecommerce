'use client'

import {useLocale} from 'next-intl'
import {useState} from 'react'

/**
 * A banner text (error, notice, status) that was written in one language. When the admin switches
 * language it disappears rather than staying in the old one; the next action writes it again.
 */
export function useMessage(): [string | null, (message: string | null) => void] {
  const locale = useLocale()
  const [stored, setStored] = useState<{text: string; locale: string} | null>(null)
  const text = stored && stored.locale === locale ? stored.text : null
  return [
    text,
    message => {
      setStored(message === null ? null : {text: message, locale})
    }
  ]
}
