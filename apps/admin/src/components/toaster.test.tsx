import {Toaster, notify} from '@/components/toaster'
import {IntlWrapper} from '@/test/render-with-providers'
import {act, render, screen, waitFor} from '@testing-library/react'
import {toast} from 'sonner'

afterEach(() => {
  act(() => {
    toast.dismiss()
  })
})

describe('Toaster', () => {
  it('announces a success as a status with a dot label and the text', async () => {
    render(<Toaster />, {wrapper: IntlWrapper})
    act(() => {
      notify.ok('Draft saved')
    })
    const status = await screen.findByRole('status')
    expect(status).toHaveTextContent('Done')
    expect(status).toHaveTextContent('Draft saved')
  })

  it('announces an error as an alert', async () => {
    render(<Toaster />, {wrapper: IntlWrapper})
    act(() => {
      notify.error('Could not save')
    })
    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('Error')
    expect(alert).toHaveTextContent('Could not save')
  })

  it('speaks the language of the provider', async () => {
    render(<Toaster />, {
      wrapper: ({children}) => <IntlWrapper locale="pl">{children}</IntlWrapper>
    })
    act(() => {
      notify.ok('Zapisano')
    })
    expect(await screen.findByRole('status')).toHaveTextContent('Gotowe')
  })

  it('dismisses a toast with its close button', async () => {
    render(<Toaster />, {wrapper: IntlWrapper})
    act(() => {
      notify.ok('Copied')
    })
    await screen.findByRole('status')
    act(() => {
      screen.getByRole('button', {name: 'Dismiss'}).click()
    })
    await waitFor(() => {
      expect(screen.queryByRole('status')).not.toBeInTheDocument()
    })
  })
})
