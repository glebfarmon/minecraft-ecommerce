import {Body, Container, Heading, Html, Link, Section, Text} from '@react-email/components'
import {render} from '@react-email/render'
import type {ReactElement} from 'react'

import type {PublicOrder} from '@shop/shared/orders'

import type {Mail} from './mailer'

async function mail(subject: string, body: ReactElement): Promise<Omit<Mail, 'to'>> {
  return {subject, html: await render(body), text: await render(body, {plainText: true})}
}

const Layout = ({
  children,
  lang = 'en'
}: {
  children: ReactElement | (ReactElement | ReactElement[])[]
  lang?: string
}) => (
  <Html lang={lang}>
    <Body style={{fontFamily: 'Arial, sans-serif', backgroundColor: '#ffffff'}}>
      <Container style={{maxWidth: 480, padding: 24}}>{children}</Container>
    </Body>
  </Html>
)

export const signInCodeMail = (code: string, brand: string) =>
  mail(
    `${code} is your ${brand} Admin sign-in code`,
    <Layout>
      <Heading as="h1">Your sign-in code</Heading>
      <Text style={{fontSize: 32, letterSpacing: 6, fontWeight: 700}}>{code}</Text>
      <Text>It expires in 5 minutes. If you did not try to sign in, ignore this email.</Text>
    </Layout>
  )

export const inviteMail = (link: string, roleName: string, brand: string) =>
  mail(
    `You are invited to ${brand} Admin`,
    <Layout>
      <Heading as="h1">You are invited</Heading>
      <Text>{`You were invited to ${brand} Admin as ${roleName}. The link is valid for 7 days.`}</Text>
      <Link href={link}>{link}</Link>
    </Layout>
  )

export const twoFactorResetMail = (brand: string) =>
  mail(
    `Your ${brand} Admin two-factor authentication was reset`,
    <Layout>
      <Heading as="h1">Two-factor authentication reset</Heading>
      <Text>
        An owner reset your two-factor authentication. Set it up again at your next sign-in.
      </Text>
    </Layout>
  )

const RECEIPT_TEXT = {
  en: {
    subject: (publicId: string) => `Your order ${publicId} is paid`,
    heading: (nick: string) => `Thank you, ${nick}!`,
    order: (publicId: string) => `Order ${publicId}`,
    body: 'Your payment went through. Items are delivered to the game server shortly; this page shows the status:',
    total: 'Total'
  },
  pl: {
    subject: (publicId: string) => `Zamówienie ${publicId} opłacone`,
    heading: (nick: string) => `Dziękujemy, ${nick}!`,
    order: (publicId: string) => `Zamówienie ${publicId}`,
    body: 'Płatność przeszła. Przedmioty trafią na serwer gry wkrótce; status zamówienia:',
    total: 'Razem'
  }
} as const

/** Sent once, when an order becomes PAID. `order.email` is masked; the caller supplies `to`. */
export function orderReceiptMail(order: PublicOrder, locale: 'en' | 'pl', statusUrl: string) {
  const t = RECEIPT_TEXT[locale]
  const format = new Intl.NumberFormat(locale, {style: 'currency', currency: order.currency})
  const money = (minor: number) => format.format(minor / 100)
  return mail(
    t.subject(order.publicId),
    <Layout lang={locale}>
      <Heading as="h1">{t.heading(order.nick)}</Heading>
      <Text>{t.body}</Text>
      <Link href={statusUrl}>{statusUrl}</Link>
      <Heading as="h2">{t.order(order.publicId)}</Heading>
      {order.servers.map(group => (
        <Section key={group.serverName}>
          <Text style={{fontWeight: 700, marginBottom: 0}}>{group.serverName}</Text>
          {group.items.map((item, i) => (
            <Text key={i} style={{margin: 0}}>
              {`${String(item.quantity)} × ${item.productName} — ${money(item.unitAmountMinor * item.quantity)}`}
            </Text>
          ))}
        </Section>
      ))}
      <Text style={{fontWeight: 700}}>{`${t.total}: ${money(order.totalMinor)}`}</Text>
    </Layout>
  )
}
