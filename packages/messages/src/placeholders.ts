import {type MessageFormatElement, TYPE, parse} from '@formatjs/icu-messageformat-parser'

function collect(elements: MessageFormatElement[], out: Set<string>): void {
  for (const el of elements) {
    switch (el.type) {
      case TYPE.argument:
      case TYPE.number:
      case TYPE.date:
      case TYPE.time:
        out.add(el.value)
        break
      case TYPE.plural:
      case TYPE.select:
        out.add(el.value)
        for (const option of Object.values(el.options)) collect(option.value, out)
        break
      case TYPE.tag:
        out.add(`<${el.value}>`)
        collect(el.children, out)
        break
      default:
        break
    }
  }
}

/** Argument names and `<tag>` names a message uses; an override must keep exactly these (spec §5). */
export function messageArguments(text: string): string[] {
  const out = new Set<string>()
  collect(parse(text), out)
  return [...out].sort()
}
