export type TitleWord = {text: string; accent: boolean}

/** `Server <accent>rules</accent>` → words, each marked accented or not, so every word can enter on its own. */
export function titleWords(message: string): TitleWord[] {
  return message.split(/(<accent>.*?<\/accent>)/).flatMap(part => {
    const accent = part.startsWith('<accent>')
    const text = accent ? part.slice('<accent>'.length, -'</accent>'.length) : part
    return text
      .split(/\s+/)
      .filter(Boolean)
      .map(word => ({text: word, accent}))
  })
}
