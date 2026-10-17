'use client'

import {useTurnstileKey} from '@/features/checkout/turnstile-key'
import {Turnstile} from '@marsidev/react-turnstile'
import type {TurnstileInstance} from '@marsidev/react-turnstile'
import {useLocale} from 'next-intl'
import type {Ref} from 'react'

type Props = {
  /** `null` when the token expired or the widget failed: the form must not submit then. */
  onToken: (token: string | null) => void
  /** Lets the form `reset()` the widget: a token works once, so every failed submit needs a fresh one. */
  widgetRef: Ref<TurnstileInstance>
}

export function TurnstileField({onToken, widgetRef}: Props) {
  const siteKey = useTurnstileKey()
  const locale = useLocale()
  return (
    <Turnstile
      ref={widgetRef}
      siteKey={siteKey}
      onSuccess={onToken}
      onExpire={() => {
        onToken(null)
      }}
      onError={() => {
        onToken(null)
      }}
      options={{language: locale, theme: 'dark', size: 'flexible'}}
    />
  )
}
