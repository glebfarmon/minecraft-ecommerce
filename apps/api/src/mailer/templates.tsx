import {Body, Container, Heading, Html, Link, Text} from '@react-email/components'
import {render} from '@react-email/render'
import type {ReactElement} from 'react'

import type {Mail} from './mailer'

async function mail(subject: string, body: ReactElement): Promise<Omit<Mail, 'to'>> {
  return {subject, html: await render(body), text: await render(body, {plainText: true})}
}

const Layout = ({children}: {children: ReactElement | ReactElement[]}) => (
  <Html lang="en">
    <Body style={{fontFamily: 'Arial, sans-serif', backgroundColor: '#ffffff'}}>
      <Container style={{maxWidth: 480, padding: 24}}>{children}</Container>
    </Body>
  </Html>
)

export const signInCodeMail = (code: string) =>
  mail(
    `${code} is your Shop Admin sign-in code`,
    <Layout>
      <Heading as="h1">Your sign-in code</Heading>
      <Text style={{fontSize: 32, letterSpacing: 6, fontWeight: 700}}>{code}</Text>
      <Text>It expires in 5 minutes. If you did not try to sign in, ignore this email.</Text>
    </Layout>
  )

export const inviteMail = (link: string, roleName: string) =>
  mail(
    'You are invited to Shop Admin',
    <Layout>
      <Heading as="h1">You are invited</Heading>
      <Text>You were invited to Shop Admin as {roleName}. The link is valid for 7 days.</Text>
      <Link href={link}>{link}</Link>
    </Layout>
  )

export const twoFactorResetMail = () =>
  mail(
    'Your Shop Admin two-factor authentication was reset',
    <Layout>
      <Heading as="h1">Two-factor authentication reset</Heading>
      <Text>
        An owner reset your two-factor authentication. Set it up again at your next sign-in.
      </Text>
    </Layout>
  )
