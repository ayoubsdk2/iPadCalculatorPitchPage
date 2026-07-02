import * as React from 'react'
import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Text,
} from '@react-email/components'
import type { TemplateEntry } from './registry'

interface Props {
  companyName?: string
  savedAt?: string
  appUrl?: string
  note?: string
}

const Email = ({
  companyName = 'your saved calculation',
  savedAt = '',
  appUrl = 'https://www.phaosai.com',
  note = '',
}: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Phaos AI Calculator: {companyName}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>Phaos AI Calculator</Heading>
        <Text style={text}>
          Here is the saved calculator file for <strong>{companyName}</strong>
          {savedAt ? <> (saved {savedAt})</> : null}.
        </Text>
        {note ? <Text style={text}>{note}</Text> : null}
        <Button style={button} href={appUrl}>
          Open the Phaos AI Calculator
        </Button>
        <Text style={footer}>
          Sign in with the same email to restore this file directly from your Saved Files.
        </Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: Email,
  subject: (data: Record<string, any>) =>
    `Phaos AI Calculator: ${data.companyName ?? 'saved calculation'}`,
  displayName: 'Saved Calculator Share',
  previewData: { companyName: 'Acme Co.', savedAt: '7/1/2026, 12:27 AM' },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif' }
const container = { padding: '24px 28px' }
const h1 = { fontSize: '22px', fontWeight: 'bold' as const, color: '#0f0f10', margin: '0 0 16px' }
const text = { fontSize: '14px', color: '#3f3f46', lineHeight: '1.5', margin: '0 0 16px' }
const button = {
  backgroundColor: '#6d28d9',
  color: '#ffffff',
  fontSize: '14px',
  fontWeight: 'bold' as const,
  borderRadius: '10px',
  padding: '12px 20px',
  textDecoration: 'none',
}
const footer = { fontSize: '12px', color: '#71717a', margin: '24px 0 0' }
