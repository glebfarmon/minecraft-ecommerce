const MAILPIT = process.env.MAILPIT_URL ?? 'http://localhost:8025'

export type Mail = {id: string; subject: string; text: string}

type Summary = {messages: {ID: string}[]}

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(`${MAILPIT}${path}`)
  if (!res.ok) throw new Error(`Mailpit ${path} answered ${String(res.status)}`)
  return (await res.json()) as T
}

/** The id of the newest message to `to`, or undefined when there is none. */
export async function newestMailId(to: string): Promise<string | undefined> {
  const list = await getJson<Summary>(
    `/api/v1/search?query=${encodeURIComponent(`to:${to}`)}&limit=1`
  )
  return list.messages[0]?.ID
}

/**
 * The newest message to `to`, retried for a few seconds because sending is not awaited. Pass the id
 * seen before an action as `after` to wait for a message newer than it.
 */
export async function latestMail(to: string, {after}: {after?: string} = {}): Promise<Mail> {
  for (let i = 0; i < 40; i++) {
    const id = await newestMailId(to)
    if (id && id !== after) {
      const msg = await getJson<{Subject: string; Text: string}>(`/api/v1/message/${id}`)
      return {id, subject: msg.Subject, text: msg.Text}
    }
    await new Promise(resolve => setTimeout(resolve, 250))
  }
  throw new Error(`no new mail to ${to}`)
}

/** The first invite link in a message. */
export function inviteLink(mail: Mail): string {
  const link = /https?:\/\/\S+?\/invite\/[\w-]{43}/.exec(mail.text)?.[0]
  if (!link) throw new Error(`no invite link in "${mail.subject}"`)
  return link
}

/**
 * Waits up to `timeoutMs` for a message to `to` whose subject starts with `subject` and whose text
 * contains `text`, looking at the newest few on every try.
 */
export async function findMail(
  to: string,
  {subject, text, timeoutMs = 30_000}: {subject: string; text: string; timeoutMs?: number}
): Promise<Mail> {
  const query = encodeURIComponent(`to:${to} subject:"${subject}"`)
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    const list = await getJson<Summary>(`/api/v1/search?query=${query}&limit=10`)
    for (const {ID} of list.messages) {
      const msg = await getJson<{Subject: string; Text: string}>(`/api/v1/message/${ID}`)
      if (msg.Subject.startsWith(subject) && msg.Text.includes(text)) {
        return {id: ID, subject: msg.Subject, text: msg.Text}
      }
    }
    await new Promise(resolve => setTimeout(resolve, 500))
  }
  throw new Error(`no mail "${subject}…" to ${to} containing "${text}"`)
}
