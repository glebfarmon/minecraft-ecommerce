import {Toaster} from '@/components/toaster'
import {copyText} from '@/lib/copy'
import {IntlWrapper} from '@/test/render-with-providers'
import {act, render, screen} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {toast} from 'sonner'

const t = (key: 'copied' | 'copyFailed', values: {label: string}) =>
  key === 'copied' ? `${values.label} copied` : `Could not copy ${values.label}`

afterEach(() => {
  act(() => {
    toast.dismiss()
  })
})

describe('copyText', () => {
  it('writes the clipboard and toasts "<label> copied"', async () => {
    userEvent.setup()
    const writeText = jest.spyOn(navigator.clipboard, 'writeText')
    render(<Toaster />, {wrapper: IntlWrapper})
    await act(async () => {
      await copyText('a@b.c', 'Email', t)
    })
    expect(writeText).toHaveBeenCalledWith('a@b.c')
    expect(await screen.findByRole('status')).toHaveTextContent('Email copied')
  })

  it('toasts an error when the clipboard refuses', async () => {
    userEvent.setup()
    jest.spyOn(navigator.clipboard, 'writeText').mockRejectedValue(new Error('denied'))
    render(<Toaster />, {wrapper: IntlWrapper})
    await act(async () => {
      await copyText('a@b.c', 'Email', t)
    })
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not copy Email')
  })
})
