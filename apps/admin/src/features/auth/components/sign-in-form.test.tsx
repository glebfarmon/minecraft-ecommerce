import {authClient} from '@/lib/auth-client'
import {fireEvent, render, screen, waitFor} from '@testing-library/react'
import {useRouter} from 'next/navigation'

import {SignInForm} from './sign-in-form'

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
