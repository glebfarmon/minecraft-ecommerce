export type Mail = {to: string; subject: string; html: string; text: string}

export interface Mailer {
  send(mail: Mail): Promise<void>
}

export const MAILER = Symbol('MAILER')
