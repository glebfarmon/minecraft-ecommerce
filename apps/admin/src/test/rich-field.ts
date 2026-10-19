import {fromDoc, toDoc} from '@/components/rich-text/markdown-doc'
import {act} from '@testing-library/react'
import type {Editor, JSONContent} from '@tiptap/core'

/** The Tiptap editor behind a `RichTextField`'s textbox (Tiptap hangs it on the DOM node). */
const editorOf = (textbox: HTMLElement) => (textbox as HTMLElement & {editor: Editor}).editor

/** Replaces the field's content, as typing would; the form sees the new markdown. */
export function setMarkdown(textbox: HTMLElement, markdown: string) {
  act(() => {
    editorOf(textbox).commands.setContent(toDoc(markdown, {multiline: true, links: true}), {
      emitUpdate: true
    })
  })
}

/** A link mark written as-is, to try hrefs the visual editor would let through. */
export function setLink(textbox: HTMLElement, label: string, href: string) {
  const doc: JSONContent = {
    type: 'doc',
    content: [
      {
        type: 'paragraph',
        content: [{type: 'text', text: label, marks: [{type: 'link', attrs: {href}}]}]
      }
    ]
  }
  act(() => {
    editorOf(textbox).commands.setContent(doc, {emitUpdate: true})
  })
}

export const markdownOf = (textbox: HTMLElement) => fromDoc(editorOf(textbox).getJSON())
