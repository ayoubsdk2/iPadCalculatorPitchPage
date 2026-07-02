import * as React from 'react'
import {
  Body, Button, Container, Head, Heading, Html, Preview, Text, Hr,
} from '@react-email/components'
import type { TemplateEntry } from './registry'

interface Props {
  inviteeName?: string
  eventName?: string
  whenLabel?: string
  timezone?: string
  hostName?: string
  manageUrl?: string
  locationLabel?: string
}

const Email = ({
  inviteeName = 'there',
  eventName = 'Phaos AI Onboarding',
  whenLabel = '',
  timezone = 'America/New_York',
  hostName = 'the Phaos AI team',
  manageUrl = 'https://www.phaosai.com',
  locationLabel = 'Video call — link to follow',
}: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>It's official! Phomo cured. Your onboarding is booked.</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>It's official! Phomo cured. 🎉</Heading>
        <Text style={text}>Hi {inviteeName},</Text>
        <Text style={text}>
          You're locked in with {hostName}. Check your inbox for the calendar
          invite — the golden ticket is on its way.
        </Text>
        <Hr style={hr} />
        <Text style={label}>What</Text>
        <Text style={value}>{eventName}</Text>
        <Text style={label}>When</Text>
        <Text style={value}>{whenLabel} <span style={muted}>({timezone})</span></Text>
        <Text style={label}>Where</Text>
        <Text style={value}>{locationLabel}</Text>
        <Hr style={hr} />
        <Button style={button} href={manageUrl}>Manage this booking</Button>
        <Text style={footer}>
          Need to reschedule or cancel? Use the link above — we'll treat your
          calendar with grace.
        </Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: Email,
  subject: (d: Record<string, any>) =>
    `Booked: ${d.eventName ?? 'Phaos AI Onboarding'} — ${d.whenLabel ?? ''}`.trim(),
  displayName: 'Phomo — Booking Confirmation',
  previewData: {
    inviteeName: 'Jordan',
    eventName: 'Phaos AI Onboarding – 60 min',
    whenLabel: 'Thu, Jul 3, 2026 at 10:00 AM',
    timezone: 'America/New_York',
    hostName: 'Daniel',
    manageUrl: 'https://www.phaosai.com/onboarding/manage?t=demo',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif' }
const container = { padding: '28px 32px', maxWidth: '560px' }
const h1 = { fontSize: '22px', fontWeight: 'bold' as const, color: '#0f0f10', margin: '0 0 16px' }
const text = { fontSize: '14px', color: '#3f3f46', lineHeight: '1.55', margin: '0 0 12px' }
const label = { fontSize: '11px', textTransform: 'uppercase' as const, color: '#71717a', margin: '12px 0 2px', letterSpacing: '0.05em' }
const value = { fontSize: '15px', color: '#0f0f10', fontWeight: 600 as const, margin: '0 0 4px' }
const muted = { color: '#71717a', fontWeight: 400 as const }
const hr = { border: 'none', borderTop: '1px solid #e4e4e7', margin: '18px 0' }
const button = { backgroundColor: '#6d28d9', color: '#ffffff', fontSize: '14px', fontWeight: 'bold' as const, borderRadius: '10px', padding: '12px 20px', textDecoration: 'none' }
const footer = { fontSize: '12px', color: '#71717a', margin: '20px 0 0' }
