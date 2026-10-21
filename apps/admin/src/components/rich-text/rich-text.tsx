import {Fragment, type ReactNode} from 'react'

import {type RichNode, parseRich} from '@shop/shared/rules'

function render(nodes: RichNode[]): ReactNode {
  return nodes.map((node, i) => {
    switch (node.type) {
      case 'strong':
        return (
          <strong key={i} className="font-semibold">
            {render(node.children)}
          </strong>
        )
      case 'em':
        return <em key={i}>{render(node.children)}</em>
      case 'u':
        return (
          <u key={i} className="underline-offset-2">
            {render(node.children)}
          </u>
        )
      case 'link':
        return (
          <a
            key={i}
            href={node.href}
            className="text-accent underline underline-offset-2"
            {...(node.href.startsWith('https://')
              ? {target: '_blank', rel: 'noopener noreferrer'}
              : {})}>
            {render(node.children)}
          </a>
        )
      case 'text':
        return <Fragment key={i}>{node.value}</Fragment>
    }
  })
}

/**
 * The mini-markdown of `@shop/shared/rules` with the admin's tokens, as the site renders it.
 * Unsafe links come back from `parseRich` as text; `links={false}` (product descriptions) keeps
 * every `[label](href)` literal.
 */
export const RichText = ({text, links = true}: {text: string; links?: boolean}) =>
  render(parseRich(text, {links}))
