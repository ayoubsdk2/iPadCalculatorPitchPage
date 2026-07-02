import * as React from 'react'
import { Body, Container, Head, Heading, Html, Preview, Text, Button } from '@react-email/components'
import type { TemplateEntry } from './registry'

interface Props {
  inviteeName?: string
  eventName?: string
  whenLabel?: string
  rebookUrl?: string
}

const Email = ({
  inviteeName = 'there',
  eventName = 'Phaos AI Onboarding',
  whenLabel = '',
  rebookUrl = 'https://www.phaosai.com',
}: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Rain check — your booking has been canceled.</Preview>
    <Body style={{ backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif' }}>
      <Container style={{ padding: '28px 32px', maxWidth: '560px' }}>
        <Heading style={{ fontSize: '22px', color: '#0f0f10', margin: '0 0 16px' }}>
          Rain check received.
        </Heading>
        <Text style={{ fontSize: '14px', color: '#3f3f46', lineHeight: '1.55' }}>
          Hi {inviteeName}, your <strong>{eventName}</strong>{whenLabel ? <> on <strong>{whenLabel}</strong></> : null} has been canceled. No worries at all — life happens, and family and health always come first.
        </Text>
        <Text style={{ fontSize: '14px', color: '#3f3f46', lineHeight: '1.55' }}>
          Whenever you're ready, pick a fresh slot below.
        </Text>
        <Button href={rebookUrl} style={{ backgroundColor: '#6d28d9', color: '#fff', fontWeight: 'bold' as const, padding: '12px 20px', borderRadius: '10px', textDecoration: 'none', fontSize: '14px' }}>
          Rebook when you're ready
        </Button>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: Email,
  subject: (d: Record<string, any>) => `Canceled: ${d.eventName ?? 'Phaos AI Onboarding'}`,
  displayName: 'Phomo — Booking Canceled',
  previewData: { inviteeName: 'Jordan', eventName: 'Phaos AI Onboarding', whenLabel: 'Thu, Jul 3 at 10:00 AM' },
} satisfies TemplateEntry
