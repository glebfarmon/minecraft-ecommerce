import {inviteMail, signInCodeMail, twoFactorResetMail} from './templates'

describe('mail templates', () => {
  it('puts the code in the subject, html and text of the sign-in mail', async () => {
    const mail = await signInCodeMail('482913')
    expect(mail.subject).toContain('482913')
    expect(mail.html).toContain('482913')
    expect(mail.text).toContain('482913')
  })
  it('links the invite and names the role', async () => {
    const mail = await inviteMail('https://admin.example.com/invite/abc', 'ADMIN')
    expect(mail.html).toContain('https://admin.example.com/invite/abc')
    expect(mail.text).toContain('ADMIN')
  })
  it('tells the person their 2FA was reset', async () => {
    expect((await twoFactorResetMail()).text).toMatch(/two-factor/i)
  })
})
