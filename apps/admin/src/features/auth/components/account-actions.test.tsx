import {authClient} from '@/lib/auth-client'
import {renderWithProviders} from '@/test/render-with-providers'
import {fireEvent, screen, waitFor} from '@testing-library/react'
import {useRouter} from 'next/navigation'
import type {ReactElement} from 'react'

import {AccountActions} from './account-actions'

const render = (ui: ReactElement) => renderWithProviders(ui, {store: false})

jest.mock('@/lib/auth-client', () => ({
  authClient: {twoFactor: {generateBackupCodes: jest.fn()}, revokeSessions: jest.fn()}
}))
jest.mock('next/navigation', () => ({useRouter: jest.fn()}))

const generateBackupCodes = jest.mocked(authClient.twoFactor.generateBackupCodes)
const revokeSessions = jest.mocked(authClient.revokeSessions)
const replace = jest.fn()

beforeEach(() => {
  jest.clearAllMocks()
  jest.mocked(useRouter).mockReturnValue({replace} as never)
  generateBackupCodes.mockResolvedValue({data: {backupCodes: ['new-1111']}, error: null})
  revokeSessions.mockResolvedValue({data: {}, error: null})
})

describe('AccountActions', () => {
  it('regenerates backup codes and shows them', async () => {
    render(<AccountActions />)
    fireEvent.click(screen.getByRole('button', {name: 'Regenerate backup codes'}))
    expect(await screen.findByText('new-1111')).toBeInTheDocument()
    expect(generateBackupCodes).toHaveBeenCalledWith({})
  })

  it('signs out everywhere and goes to the login page', async () => {
    render(<AccountActions />)
    fireEvent.click(screen.getByRole('button', {name: 'Sign out everywhere'}))
    await waitFor(() => {
      expect(revokeSessions).toHaveBeenCalled()
      expect(replace).toHaveBeenCalledWith('/login')
    })
  })
})
