import {authClient} from '@/lib/auth-client'
import {fireEvent, render, screen, waitFor} from '@testing-library/react'
import {useRouter} from 'next/navigation'

import {TotpChallenge} from './totp-challenge'

jest.mock('@/lib/auth-client', () => ({
  authClient: {twoFactor: {verifyTotp: jest.fn(), verifyBackupCode: jest.fn()}}
}))
jest.mock('next/navigation', () => ({useRouter: jest.fn()}))

const verifyTotp = jest.mocked(authClient.twoFactor.verifyTotp)
const verifyBackupCode = jest.mocked(authClient.twoFactor.verifyBackupCode)
const replace = jest.fn()

beforeEach(() => {
  jest.clearAllMocks()
  jest.mocked(useRouter).mockReturnValue({replace} as never)
  verifyTotp.mockResolvedValue({data: {}, error: null})
  verifyBackupCode.mockResolvedValue({data: {}, error: null})
})

describe('TotpChallenge', () => {
  it('accepts an app code', async () => {
    render(<TotpChallenge />)
    fireEvent.change(screen.getByLabelText('Code from the app'), {target: {value: '654321'}})
    fireEvent.click(screen.getByRole('button', {name: 'Verify'}))
    await waitFor(() => {
      expect(verifyTotp).toHaveBeenCalledWith({code: '654321', trustDevice: false})
      expect(replace).toHaveBeenCalledWith('/')
    })
  })

  it('accepts a backup code instead', async () => {
    render(<TotpChallenge />)
    fireEvent.click(screen.getByRole('button', {name: 'Use a backup code'}))
    fireEvent.change(screen.getByLabelText('Backup code'), {target: {value: 'aaaa-1111'}})
    fireEvent.click(screen.getByRole('button', {name: 'Verify'}))
    await waitFor(() => {
      expect(verifyBackupCode).toHaveBeenCalledWith({code: 'aaaa-1111', trustDevice: false})
    })
  })

  it('asks to wait after too many attempts (429)', async () => {
    verifyTotp.mockResolvedValueOnce({data: null, error: {status: 429}})
    render(<TotpChallenge />)
    fireEvent.change(screen.getByLabelText('Code from the app'), {target: {value: '654321'}})
    fireEvent.click(screen.getByRole('button', {name: 'Verify'}))
    expect(await screen.findByRole('alert')).toHaveTextContent('Too many attempts')
  })
})
