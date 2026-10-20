import {IntlTooltipWrapper} from '@/test/render-with-providers'
import {act, render as rtlRender, screen, waitFor} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type {Editor} from '@tiptap/core'
import type {ReactElement} from 'react'

import {RichTextField} from './rich-text-field'

const render = (ui: ReactElement) => rtlRender(ui, {wrapper: IntlTooltipWrapper})

// jsdom has no clipboard events; ProseMirror only needs these two.
function installClipboard() {
  class FakeData {
    private readonly data = new Map<string, string>()
    setData(type: string, value: string) {
      this.data.set(type, value)
    }
    getData(type: string) {
      return this.data.get(type) ?? ''
    }
  }
  Object.assign(globalThis, {
    DataTransfer: FakeData,
    ClipboardEvent: class extends Event {
      clipboardData: unknown
      constructor(type: string, init?: {clipboardData?: unknown}) {
        super(type, {cancelable: true})
        this.clipboardData = init?.clipboardData
      }
    }
  })
}

describe('RichTextField', () => {
  it('renders marks inside a textbox named by its label', async () => {
    render(
      <>
        <span id="label">Description</span>
        <RichTextField id="f" value="**Hi** there" onChange={jest.fn()} aria-labelledby="label" />
      </>
    )
    const box = await screen.findByRole('textbox', {name: 'Description'})
    await waitFor(() => {
      expect(box.querySelector('strong')).toHaveTextContent('Hi')
    })
  })

  it('shows an outside value change', async () => {
    const {rerender} = render(<RichTextField id="f" value="one" onChange={jest.fn()} />)
    expect(await screen.findByText('one')).toBeInTheDocument()
    rerender(<RichTextField id="f" value="two ++u++" onChange={jest.fn()} />)
    await waitFor(() => {
      expect(screen.getByRole('textbox').querySelector('u')).toHaveTextContent('u')
    })
    expect(screen.queryByText('one')).not.toBeInTheDocument()
  })

  it('bolds the selected word with Mod-b and reports markdown', async () => {
    const onChange = jest.fn()
    let editor: Editor | undefined
    render(
      <RichTextField
        id="f"
        value="make bold now"
        onChange={onChange}
        onReady={e => {
          editor = e
        }}
      />
    )
    await screen.findByText('make bold now')
    act(() => {
      editor?.chain().focus().setTextSelection({from: 6, to: 10}).run()
    })
    // Tiptap moves focus on the next frame.
    await waitFor(() => {
      expect(editor?.isFocused).toBe(true)
    })
    await userEvent.keyboard('{Control>}b{/Control}')
    expect(onChange).toHaveBeenLastCalledWith('make **bold** now')
  })

  it('swallows Enter in a single-line field and keeps it in a multiline one', async () => {
    const single = jest.fn()
    const {unmount} = render(<RichTextField id="s" value="ab" onChange={single} />)
    await userEvent.click(await screen.findByRole('textbox'))
    await userEvent.keyboard('{Enter}')
    expect(single).not.toHaveBeenCalled()
    unmount()

    const multi = jest.fn()
    render(<RichTextField id="m" value="ab" multiline onChange={multi} />)
    await userEvent.click(await screen.findByRole('textbox'))
    await userEvent.keyboard('{Enter}')
    expect(multi).toHaveBeenCalled()
  })

  it('has no formatting commands beyond bold, italic and underline', async () => {
    let editor: Editor | undefined
    render(
      <RichTextField
        id="f"
        value=""
        onChange={jest.fn()}
        onReady={e => {
          editor = e
        }}
      />
    )
    await screen.findByRole('textbox')
    const names = Object.keys(editor?.schema.marks ?? {})
    expect(names.sort()).toEqual(['bold', 'italic', 'underline'])
    expect(Object.keys(editor?.schema.nodes ?? {}).sort()).toEqual(['doc', 'paragraph', 'text'])
  })

  it('shows links only when links are on', async () => {
    let editor: Editor | undefined
    render(
      <RichTextField
        id="f"
        value=""
        links
        onChange={jest.fn()}
        onReady={e => {
          editor = e
        }}
      />
    )
    await screen.findByRole('textbox')
    expect(Object.keys(editor?.schema.marks ?? {})).toContain('link')
  })

  it('bolds the selection from the toolbar and shows it pressed', async () => {
    const onChange = jest.fn()
    let editor: Editor | undefined
    render(
      <RichTextField
        id="f"
        value="make bold now"
        onChange={onChange}
        onReady={e => {
          editor = e
        }}
      />
    )
    await screen.findByText('make bold now')
    act(() => {
      editor?.chain().focus().setTextSelection({from: 6, to: 10}).run()
    })
    await waitFor(() => {
      expect(editor?.isFocused).toBe(true)
    })
    const bold = await screen.findByRole('button', {name: 'Bold', hidden: true})
    expect(bold).toHaveAttribute('aria-pressed', 'false')
    await userEvent.click(bold)
    expect(onChange).toHaveBeenLastCalledWith('make **bold** now')
    await waitFor(() => {
      expect(bold).toHaveAttribute('aria-pressed', 'true')
    })
  })

  it('turns typed [label](href) into a link when links are on', async () => {
    let editor: Editor | undefined
    const onChange = jest.fn()
    render(
      <RichTextField
        id="f"
        value=""
        links
        onChange={onChange}
        onReady={e => {
          editor = e
        }}
      />
    )
    await screen.findByRole('textbox')
    act(() => {
      editor?.commands.insertContent('see [rules](/rules')
    })
    const view = editor?.view
    const {from, to} = view?.state.selection ?? {from: 0, to: 0}
    act(() => {
      view?.someProp('handleTextInput', f => f(view, from, to, ')', () => view.state.tr))
    })
    expect(onChange).toHaveBeenLastCalledWith('see [rules](/rules)')
    expect(screen.getByRole('textbox').querySelector('a')).toHaveAttribute('href', '/rules')
  })

  it('does not report a value that only arrived from outside', async () => {
    const onChange = jest.fn()
    const {rerender} = render(<RichTextField id="f" value="" onChange={onChange} />)
    await screen.findByRole('textbox')
    rerender(<RichTextField id="f" value="++loaded++" onChange={onChange} />)
    await waitFor(() => {
      expect(screen.getByRole('textbox').querySelector('u')).toHaveTextContent('loaded')
    })
    expect(onChange).not.toHaveBeenCalled()
  })

  it.each(['Be polite (no insults).', 'C++ and C#', 'Use [brackets]', '2 * 3'])(
    'does not report stored text %j just by mounting',
    async stored => {
      const onChange = jest.fn()
      render(<RichTextField id="f" value={stored} onChange={onChange} />)
      await screen.findByText(stored)
      expect(onChange).not.toHaveBeenCalled()
    }
  )

  it('cannot undo into the previous outside value', async () => {
    const onChange = jest.fn()
    let editor: Editor | undefined
    const onReady = (e: Editor) => {
      editor = e
    }
    const {rerender} = render(
      <RichTextField id="f" value="English rule" onChange={onChange} onReady={onReady} />
    )
    await screen.findByText('English rule')
    rerender(<RichTextField id="f" value="Polska zasada" onChange={onChange} onReady={onReady} />)
    await screen.findByText('Polska zasada')
    act(() => {
      editor?.commands.undo()
    })
    expect(screen.getByRole('textbox')).toHaveTextContent('Polska zasada')
    expect(onChange).not.toHaveBeenCalled()
  })

  it('keeps typed _x_ and *x* as literal text', async () => {
    const onChange = jest.fn()
    let editor: Editor | undefined
    render(
      <RichTextField
        id="f"
        value=""
        onChange={onChange}
        onReady={e => {
          editor = e
        }}
      />
    )
    await screen.findByRole('textbox')
    const view = editor?.view
    act(() => {
      // What the browser does per key: input rules get the first go, then the character lands.
      for (const ch of 'ban _Steve_ a *note* ') {
        const {from, to} = view?.state.selection ?? {from: 1, to: 1}
        const handled = view?.someProp('handleTextInput', f =>
          f(view, from, to, ch, () => view.state.tr)
        )
        if (!handled) view?.dispatch(view.state.tr.insertText(ch, from, to))
      }
    })
    expect(onChange).toHaveBeenLastCalledWith('ban _Steve_ a \\*note\\* ')
    expect(screen.getByRole('textbox').querySelector('em, strong')).toBeNull()
  })

  it('does not link pasted plain domains or http URLs', async () => {
    let editor: Editor | undefined
    render(
      <RichTextField
        id="f"
        value=""
        links
        onChange={jest.fn()}
        onReady={e => {
          editor = e
        }}
      />
    )
    await screen.findByRole('textbox')
    installClipboard()
    const view = editor?.view
    act(() => {
      view?.pasteText('server play.example.net or http://x.com')
    })
    expect(screen.getByRole('textbox').querySelector('a')).toBeNull()
  })

  it('is not editable while disabled', async () => {
    render(<RichTextField id="f" value="x" disabled onChange={jest.fn()} />)
    expect(await screen.findByRole('textbox')).toHaveAttribute('contenteditable', 'false')
  })

  it('flattens pasted blocks in a single-line field', async () => {
    let editor: Editor | undefined
    const onChange = jest.fn()
    render(
      <RichTextField
        id="f"
        value=""
        onChange={onChange}
        onReady={e => {
          editor = e
        }}
      />
    )
    await screen.findByRole('textbox')
    installClipboard()
    const view = editor?.view
    act(() => {
      view?.pasteHTML('<h1>Title</h1><ul><li>one</li><li>two</li></ul>')
    })
    expect(onChange).toHaveBeenLastCalledWith('Title one two')
    expect(screen.getByRole('textbox').querySelectorAll('p')).toHaveLength(1)
  })

  it('does not link a typed [label](href) whose href is unsafe', async () => {
    let editor: Editor | undefined
    render(
      <RichTextField
        id="f"
        value=""
        links
        onChange={jest.fn()}
        onReady={e => {
          editor = e
        }}
      />
    )
    await screen.findByRole('textbox')
    act(() => {
      editor?.commands.insertContent('[x](//evil.com')
    })
    const view = editor?.view
    const {from, to} = view?.state.selection ?? {from: 0, to: 0}
    act(() => {
      view?.someProp('handleTextInput', f => f(view, from, to, ')', () => view.state.tr))
    })
    expect(screen.getByRole('textbox').querySelector('a')).toBeNull()
  })

  it('shows a changed placeholder without being rebuilt', async () => {
    const field = (placeholder: string) => (
      <RichTextField id="ph" value="" onChange={jest.fn()} placeholder={placeholder} />
    )
    const {rerender, container} = render(field('Uses the English text'))
    await waitFor(() => {
      expect(container.querySelector('[data-placeholder]')).toHaveAttribute(
        'data-placeholder',
        'Uses the English text'
      )
    })
    rerender(field('Używa tekstu angielskiego'))
    await waitFor(() => {
      expect(container.querySelector('[data-placeholder]')).toHaveAttribute(
        'data-placeholder',
        'Używa tekstu angielskiego'
      )
    })
  })
})
