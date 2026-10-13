import {authClient} from '@/lib/auth-client'
import {fireEvent, render, screen, waitFor} from '@testing-library/react'
import {useRouter} from 'next/navigation'

import {TotpSetup} from './totp-setup'

jest.mock('@/lib/auth-client', () => ({
  authClient: {twoFactor: {enable: jest.fn(), verifyTotp: jest.fn()}}
}))
jest.mock('next/navigation', () => ({useRouter: jest.fn()}))

const enable = jest.mocked(authClient.twoFactor.enable)
const verifyTotp = jest.mocked(authClient.twoFactor.verifyTotp)
const replace = jest.fn()

beforeEach(() => {
  jest.clearAllMocks()
  jest.mocked(useRouter).mockReturnValue({replace} as never)
  enable.mockResolvedValue({
    data: {
      method: 'totp',
      totpURI: 'otpauth://totp/Shop:a?secret=ABC',
      backupCodes: ['aaaa-1111', 'bbbb-2222']
    },
    error: null
  })
  verifyTotp.mockResolvedValue({data: {}, error: null})
})

describe('TotpSetup', () => {
  it('shows the QR and secret, confirms a code, then shows backup codes once', async () => {
    render(<TotpSetup />)
    expect(
      await screen.findByRole('img', {name: 'QR code for your authenticator app'})
    ).toBeInTheDocument()
    expect(screen.getByTestId('totp-secret')).toHaveTextContent('ABC')
    expect(screen.queryByText('aaaa-1111')).not.toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Code from the app'), {target: {value: '123456'}})
    fireEvent.click(screen.getByRole('button', {name: 'Confirm'}))
    expect(await screen.findByText('aaaa-1111')).toBeInTheDocument()
    expect(verifyTotp).toHaveBeenCalledWith({code: '123456'})
    fireEvent.click(screen.getByRole('button', {name: 'I saved them'}))
    await waitFor(() => {
      expect(replace).toHaveBeenCalledWith('/')
    })
  })

  it('keeps the backup codes hidden when the code is wrong', async () => {
    verifyTotp.mockResolvedValueOnce({data: null, error: {status: 400}})
    render(<TotpSetup />)
    await screen.findByRole('img', {name: 'QR code for your authenticator app'})
    fireEvent.change(screen.getByLabelText('Code from the app'), {target: {value: '000000'}})
    fireEvent.click(screen.getByRole('button', {name: 'Confirm'}))
    expect(await screen.findByRole('alert')).toHaveTextContent('That code did not work')
    expect(screen.queryByText('aaaa-1111')).not.toBeInTheDocument()
  })
})
