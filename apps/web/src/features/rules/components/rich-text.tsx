import type {ReactNode} from 'react'
import {Fragment} from 'react'

import {type RichNode, parseRich} from '@shop/shared/rules'

const identity = (value: string): ReactNode => value

function render(nodes: RichNode[], mark: (value: string) => ReactNode): ReactNode {
  return nodes.map((node, i) => {
    switch (node.type) {
      case 'strong':
        return (
          <strong key={i} className="font-semibold text-fg">
            {render(node.children, mark)}
          </strong>
        )
      case 'em':
        return <em key={i}>{render(node.children, mark)}</em>
      case 'u':
        return (
          <u key={i} className="underline-offset-2">
            {render(node.children, mark)}
          </u>
        )
      case 'link': {
        const external = node.href.startsWith('https://')
        return (
          <a
            key={i}
            href={node.href}
            className="text-accent underline underline-offset-2 hover:text-fg"
            {...(external ? {target: '_blank', rel: 'noopener noreferrer'} : {})}>
            {render(node.children, mark)}
          </a>
        )
      }
      case 'text':
        return <Fragment key={i}>{mark(node.value)}</Fragment>
    }
  })
}

/**
 * Renders mini-markdown (rules, product descriptions). `mark` wraps each text run, so search can
 * highlight inside bold or links. `links` is off for descriptions: `[a](b)` stays literal there.
 */
export function RichText({
  text,
  mark = identity,
  links = true
}: {
  text: string
  mark?: (value: string) => ReactNode
  links?: boolean
}) {
  return render(parseRich(text, {links}), mark)
}
