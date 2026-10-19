'use client'

import {Hint} from '@/components/hint'
import {type Editor, InputRule} from '@tiptap/core'
import Bold from '@tiptap/extension-bold'
import Document from '@tiptap/extension-document'
import HardBreak from '@tiptap/extension-hard-break'
import Italic from '@tiptap/extension-italic'
import Link from '@tiptap/extension-link'
import Paragraph from '@tiptap/extension-paragraph'
import Text from '@tiptap/extension-text'
import Underline from '@tiptap/extension-underline'
import {Placeholder, UndoRedo} from '@tiptap/extensions'
import {EditorContent, useEditor, useEditorState} from '@tiptap/react'
import {BubbleMenu} from '@tiptap/react/menus'
import {Bold as BoldIcon, Italic as ItalicIcon, Underline as UnderlineIcon} from 'lucide-react'
import {useEffect, useMemo, useRef} from 'react'

import {cn} from '@shop/ui/lib/utils'

import {fromDoc, toDoc} from './markdown-doc'

const MARKS = [
  {name: 'bold', label: 'Bold', hint: 'Bold ⌘B', icon: BoldIcon},
  {name: 'italic', label: 'Italic', hint: 'Italic ⌘I', icon: ItalicIcon},
  {name: 'underline', label: 'Underline', hint: 'Underline ⌘U', icon: UnderlineIcon}
] as const
type MarkName = (typeof MARKS)[number]['name']

const toggle = (editor: Editor, name: MarkName) => {
  const chain = editor.chain().focus()
  if (name === 'bold') chain.toggleBold().run()
  else if (name === 'italic') chain.toggleItalic().run()
  else chain.toggleUnderline().run()
}

// Typing `[label](href)` makes a link, as the rules text did before the editor was visual.
// The href is not checked here: the rules schema refuses unsafe ones at save.
const LinkWithMarkdownInput = Link.extend({
  addInputRules() {
    return [
      new InputRule({
        find: /\[([^\]]+)\]\(([^)\s]+)\)$/,
        handler: ({state, range, match}) => {
          const [, label = '', href = ''] = match
          const mark = this.type.create({href})
          state.tr.replaceWith(range.from, range.to, state.schema.text(label, [mark]))
        }
      })
    ]
  }
})

function SelectionToolbar({editor}: {editor: Editor}) {
  const state = useEditorState({
    editor,
    selector: ({editor: e}) => ({
      open: e.isFocused && !e.state.selection.empty,
      bold: e.isActive('bold'),
      italic: e.isActive('italic'),
      underline: e.isActive('underline')
    })
  })
  return (
    <BubbleMenu
      editor={editor}
      className="rich-toolbar-wrap z-50"
      options={{placement: 'top', offset: 8}}>
      <div
        role="toolbar"
        aria-label="Text formatting"
        data-state={state.open ? 'open' : 'closed'}
        className="rich-toolbar flex gap-0.5 rounded-plate border border-border bg-card-raised p-1 shadow-lg shadow-black/40">
        {MARKS.map(({name, label, hint, icon: Icon}) => (
          <Hint key={name} label={hint}>
            <button
              type="button"
              aria-label={label}
              aria-pressed={state[name]}
              // Keep the selection: the editor must not lose focus to the button.
              onMouseDown={event => {
                event.preventDefault()
              }}
              onClick={() => {
                toggle(editor, name)
              }}
              className="grid size-7 place-items-center rounded-lg text-muted transition-colors hover:text-fg focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none aria-pressed:bg-accent-soft aria-pressed:text-accent">
              <Icon aria-hidden className="size-3.5" />
            </button>
          </Hint>
        ))}
      </div>
    </BubbleMenu>
  )
}

/**
 * A text field with bold, italic and underline (and links when `links`), stored as the mini-markdown
 * of `@shop/shared/rules`. Selecting text shows the formatting toolbar; ⌘B / ⌘I / ⌘U also work.
 */
export function RichTextField({
  id,
  value,
  onChange,
  multiline = false,
  links = false,
  disabled = false,
  placeholder,
  onReady,
  'aria-invalid': ariaInvalid,
  'aria-describedby': ariaDescribedBy,
  'aria-labelledby': ariaLabelledBy
}: {
  'id': string
  'value': string
  'onChange': (markdown: string) => void
  'multiline'?: boolean
  'links'?: boolean
  'disabled'?: boolean
  'placeholder'?: string
  /** Hands the editor out; tests drive selections through it. */
  'onReady'?: (editor: Editor) => void
  'aria-invalid'?: boolean
  'aria-describedby'?: string
  'aria-labelledby'?: string
}) {
  const options = useMemo(() => ({multiline, links}), [multiline, links])
  const latest = useRef({onChange, onReady})
  // The markdown the editor last held. The editor is created from the first render's value and
  // fires `update` once while mounting; that is not an edit, so it must not reach the form.
  const known = useRef(value)
  useEffect(() => {
    latest.current = {onChange, onReady}
  })

  const editor = useEditor({
    immediatelyRender: false,
    editable: !disabled,
    extensions: [
      Document,
      Paragraph,
      Text,
      Bold,
      Italic,
      Underline,
      UndoRedo,
      Placeholder.configure({placeholder: placeholder ?? ''}),
      ...(multiline ? [HardBreak] : []),
      ...(links
        ? [
            LinkWithMarkdownInput.configure({
              openOnClick: false,
              autolink: false,
              protocols: ['https']
            })
          ]
        : [])
    ],
    content: toDoc(value, options),
    editorProps: {
      attributes: {
        id,
        'role': 'textbox',
        'aria-multiline': String(multiline),
        ...(ariaInvalid ? {'aria-invalid': 'true'} : {}),
        ...(ariaDescribedBy ? {'aria-describedby': ariaDescribedBy} : {}),
        ...(ariaLabelledBy ? {'aria-labelledby': ariaLabelledBy} : {}),
        'class': cn(
          'rich-field rounded-plate border border-border bg-surface px-3 py-[7px] text-sm leading-5 text-fg focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none',
          multiline ? 'min-h-16 py-2' : 'whitespace-nowrap',
          ariaInvalid && 'border-bad',
          disabled && 'cursor-not-allowed opacity-50'
        )
      },
      handleKeyDown: (_view, event) => !multiline && event.key === 'Enter',
      // A single-line field never holds a line break, however it was pasted.
      ...(multiline
        ? {}
        : {
            transformPastedText: (text: string) => text.replace(/\s*\n\s*/g, ' '),
            transformPastedHTML: (html: string) =>
              html.replace(/<\/p>\s*<p[^>]*>|<br\s*\/?>/gi, ' ')
          })
    },
    onUpdate: ({editor: e}) => {
      const markdown = fromDoc(e.getJSON())
      if (markdown === known.current) return
      known.current = markdown
      latest.current.onChange(markdown)
    }
  })

  useEffect(() => {
    if (editor) latest.current.onReady?.(editor)
  }, [editor])

  useEffect(() => {
    editor?.setEditable(!disabled)
  }, [editor, disabled])

  // A form reset or a tab switch changes `value` from outside; typing never trips this.
  useEffect(() => {
    if (editor && fromDoc(editor.getJSON()) !== value) {
      known.current = value
      editor.commands.setContent(toDoc(value, options), {emitUpdate: false})
    }
  }, [editor, value, options])

  return (
    <>
      <EditorContent editor={editor} />
      {editor && !disabled && <SelectionToolbar editor={editor} />}
    </>
  )
}
