import {authClient} from '@/lib/auth-client'
import {renderWithProviders} from '@/test/render-with-providers'
import {fireEvent, screen, waitFor} from '@testing-library/react'
import {useRouter} from 'next/navigation'
import type {ReactElement} from 'react'

import {SignInForm} from './sign-in-form'

const render = (ui: ReactElement) => renderWithProviders(ui, {store: false})

jest.mock('@/lib/auth-client', () => ({
  authClient: {
    emailOtp: {sendVerificationOtp: jest.fn()},
    signIn: {emailOtp: jest.fn(), social: jest.fn()}
  }
}))
jest.mock('next/navigation', () => ({useRouter: jest.fn()}))

const sendVerificationOtp = jest.mocked(authClient.emailOtp.sendVerificationOtp)
const emailOtp = jest.mocked(authClient.signIn.emailOtp)
const social = jest.mocked(authClient.signIn.social)
const push = jest.fn()

beforeEach(() => {
  jest.clearAllMocks()
  jest.mocked(useRouter).mockReturnValue({push} as never)
  sendVerificationOtp.mockResolvedValue({data: {success: true}, error: null})
  emailOtp.mockResolvedValue({data: {}, error: null})
})

describe('SignInForm', () => {
  it('asks for the code after sending it, then signs in and goes to 2FA', async () => {
    render(<SignInForm googleEnabled={false} />)
    fireEvent.change(screen.getByLabelText('Email'), {target: {value: 'Ann@Example.com'}})
    fireEvent.click(screen.getByRole('button', {name: 'Send code'}))
    await waitFor(() => {
      expect(sendVerificationOtp).toHaveBeenCalledWith({email: 'ann@example.com', type: 'sign-in'})
    })
    fireEvent.change(await screen.findByLabelText('6-digit code'), {target: {value: '123456'}})
    fireEvent.click(screen.getByRole('button', {name: 'Sign in'}))
    await waitFor(() => {
      expect(emailOtp).toHaveBeenCalledWith({email: 'ann@example.com', otp: '123456'})
      expect(push).toHaveBeenCalledWith('/2fa')
    })
  })

  it('locks the email for an invite and offers Google when enabled', () => {
    render(<SignInForm email="ann@example.com" googleEnabled />)
    expect(screen.getByLabelText('Email')).toHaveAttribute('readonly')
    fireEvent.click(screen.getByRole('button', {name: 'Continue with Google'}))
    expect(social).toHaveBeenCalledWith({provider: 'google', callbackURL: '/2fa'})
  })

  it('shows a wrong-code error without leaving the form', async () => {
    emailOtp.mockResolvedValueOnce({data: null, error: {message: 'Invalid OTP'}})
    render(<SignInForm googleEnabled={false} />)
    fireEvent.change(screen.getByLabelText('Email'), {target: {value: 'a@x.io'}})
    fireEvent.click(screen.getByRole('button', {name: 'Send code'}))
    fireEvent.change(await screen.findByLabelText('6-digit code'), {target: {value: '000000'}})
    fireEvent.click(screen.getByRole('button', {name: 'Sign in'}))
    expect(await screen.findByRole('alert')).toHaveTextContent('That code did not work')
  })

  it('tells the visitor an uninvited email cannot sign in (403)', async () => {
    emailOtp.mockResolvedValueOnce({data: null, error: {status: 403}})
    render(<SignInForm googleEnabled={false} />)
    fireEvent.change(screen.getByLabelText('Email'), {target: {value: 'a@x.io'}})
    fireEvent.click(screen.getByRole('button', {name: 'Send code'}))
    fireEvent.change(await screen.findByLabelText('6-digit code'), {target: {value: '111111'}})
    fireEvent.click(screen.getByRole('button', {name: 'Sign in'}))
    expect(await screen.findByRole('alert')).toHaveTextContent('not invited')
  })
})

describe('SignInForm accessibility and send errors', () => {
  it('links field errors to the email and code inputs', async () => {
    render(<SignInForm googleEnabled={false} />)
    fireEvent.change(screen.getByLabelText('Email'), {target: {value: 'nope'}})
    fireEvent.click(screen.getByRole('button', {name: 'Send code'}))
    const alert = await screen.findByRole('alert')
    const email = screen.getByLabelText('Email')
    expect(email).toHaveAttribute('aria-invalid', 'true')
    expect(email).toHaveAttribute('aria-describedby', alert.id)

    fireEvent.change(email, {target: {value: 'a@x.io'}})
    fireEvent.click(screen.getByRole('button', {name: 'Send code'}))
    fireEvent.change(await screen.findByLabelText('6-digit code'), {target: {value: '12'}})
    fireEvent.click(screen.getByRole('button', {name: 'Sign in'}))
    const codeAlert = await screen.findByRole('alert')
    const code = screen.getByLabelText('6-digit code')
    expect(code).toHaveAttribute('aria-invalid', 'true')
    expect(code).toHaveAttribute('aria-describedby', codeAlert.id)
  })

  it('stays on the email step with a wait message on 429', async () => {
    sendVerificationOtp.mockResolvedValueOnce({data: null, error: {status: 429}})
    render(<SignInForm googleEnabled={false} />)
    fireEvent.change(screen.getByLabelText('Email'), {target: {value: 'a@x.io'}})
    fireEvent.click(screen.getByRole('button', {name: 'Send code'}))
    expect(await screen.findByRole('alert')).toHaveTextContent('Too many attempts')
    expect(screen.queryByLabelText('6-digit code')).not.toBeInTheDocument()
  })

  it('stays on the email step with a generic message on a network error', async () => {
    sendVerificationOtp.mockRejectedValueOnce(new Error('network'))
    render(<SignInForm googleEnabled={false} />)
    fireEvent.change(screen.getByLabelText('Email'), {target: {value: 'a@x.io'}})
    fireEvent.click(screen.getByRole('button', {name: 'Send code'}))
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not send the code')
    expect(screen.queryByLabelText('6-digit code')).not.toBeInTheDocument()
  })
})
