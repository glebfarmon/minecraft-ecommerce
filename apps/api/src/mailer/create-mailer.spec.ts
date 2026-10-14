import {createMailer} from './create-mailer'
import {MemoryMailer} from './memory-mailer'
import {ResendMailer} from './resend-mailer'
import {SmtpMailer} from './smtp-mailer'

describe('createMailer', () => {
  it('uses Resend when an API key is set', () => {
    expect(createMailer({RESEND_API_KEY: 're_x', MAIL_FROM: 'a@b.c'})).toBeInstanceOf(ResendMailer)
  })
  it('uses SMTP (Mailpit) when SMTP_URL is set', () => {
    expect(createMailer({SMTP_URL: 'smtp://mailpit:1025', MAIL_FROM: 'a@b.c'})).toBeInstanceOf(
      SmtpMailer
    )
  })
  it('keeps mail in memory otherwise', async () => {
    const mailer = createMailer({})
    expect(mailer).toBeInstanceOf(MemoryMailer)
    await mailer.send({to: 'x@y.z', subject: 's', html: '<p>h</p>', text: 'h'})
    expect((mailer as MemoryMailer).lastTo('x@y.z')?.subject).toBe('s')
  })

  it('refuses to start in production without a mail transport', () => {
    expect(() => createMailer({NODE_ENV: 'production'})).toThrow(/RESEND_API_KEY or SMTP_URL/)
    expect(createMailer({NODE_ENV: 'production', SMTP_URL: 'smtp://m:1025'})).toBeInstanceOf(
      SmtpMailer
    )
    expect(createMailer({NODE_ENV: 'production', RESEND_API_KEY: 're_x'})).toBeInstanceOf(
      ResendMailer
    )
  })
})

describe('MemoryMailer', () => {
  it('never logs the subject (sign-in codes travel in it)', async () => {
    const env = process.env.NODE_ENV
    process.env.NODE_ENV = 'development'
    const log = jest.spyOn(console, 'log').mockImplementation(() => undefined)
    try {
      await new MemoryMailer().send({
        to: 'x@y.z',
        subject: '123456 is your Shop Admin sign-in code',
        html: '<p>123456</p>',
        text: '123456'
      })
      const printed = log.mock.calls.flat().join(' ')
      expect(printed).not.toMatch(/123456/)
      expect(printed).toMatch(/x@y\.z/)
    } finally {
      log.mockRestore()
      process.env.NODE_ENV = env
    }
  })
})
