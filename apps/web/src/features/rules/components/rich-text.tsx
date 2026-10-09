import {parseInline} from '@/features/rules/lib/inline-markdown'
import type {ReactNode} from 'react'
import {Fragment} from 'react'

const identity = (value: string): ReactNode => value

/** Renders rule mini-markdown. `mark` wraps each text run, so search can highlight inside bold or links. */
export function RichText({
  text,
  mark = identity
}: {
  text: string
  mark?: (value: string) => ReactNode
}) {
  return parseInline(text).map((token, i) => {
    switch (token.type) {
      case 'strong':
        return (
          <strong key={i} className="font-semibold text-fg">
            {mark(token.value)}
          </strong>
        )
      case 'em':
        return <em key={i}>{mark(token.value)}</em>
      case 'link': {
        const external = token.href.startsWith('https://')
        return (
          <a
            key={i}
            href={token.href}
            className="text-accent underline underline-offset-2 hover:text-fg"
            {...(external ? {target: '_blank', rel: 'noopener noreferrer'} : {})}>
            {mark(token.value)}
          </a>
        )
      }
      default:
        return <Fragment key={i}>{mark(token.value)}</Fragment>
    }
  })
}
