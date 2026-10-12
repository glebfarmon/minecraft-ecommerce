import {hashInviteToken, newInviteToken} from './invite-token'

describe('invite token', () => {
  it('is 32 random bytes as base64url and stores only its SHA-256', () => {
    const {token, tokenHash} = newInviteToken()
    expect(Buffer.from(token, 'base64url')).toHaveLength(32)
    expect(tokenHash).toBe(hashInviteToken(token))
    expect(tokenHash).not.toContain(token)
    expect(newInviteToken().token).not.toBe(token)
  })
})
