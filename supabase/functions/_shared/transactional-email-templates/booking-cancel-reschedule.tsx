import * as React from 'npm:react@18.3.1'
import {
  Body, Button, Container, Head, Heading, Hr, Html, Preview, Section, Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = 'Tropics MedSpa'

interface Props {
  clientName?: string
  treatment?: string
  date?: string
  time?: string
  cancelUrl?: string
  rescheduleUrl?: string
  whatsappUrl?: string
  rebookUrl?: string
}

const BookingCancelReschedule = ({
  clientName, treatment, date, time, cancelUrl, rescheduleUrl, whatsappUrl, rebookUrl,
}: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Your {SITE_NAME} appointment has been updated</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={header}>
          <Heading style={brand}>{SITE_NAME}</Heading>
        </Section>
        <Section style={card}>
          <Heading style={h1}>
            {clientName ? `Hi ${clientName}, your appointment was cancelled` : 'Your appointment was cancelled'}
          </Heading>
          <Text style={text}>
            We've cancelled the appointment below as requested. We'd love to see
            you again whenever you're ready — book any time.
          </Text>

          <Section style={detailBlock}>
            {treatment && <Text style={detail}><strong>Treatment:</strong> {treatment}</Text>}
            {date && <Text style={detail}><strong>Date:</strong> {date}</Text>}
            {time && <Text style={detail}><strong>Time:</strong> {time}</Text>}
          </Section>

          <Section style={{ textAlign: 'center', margin: '24px 0 8px' }}>
            {rebookUrl && (
              <Button style={primaryButton} href={rebookUrl}>Book again</Button>
            )}
            {!rebookUrl && rescheduleUrl && (
              <Button style={primaryButton} href={rescheduleUrl}>Reschedule</Button>
            )}
            {!rebookUrl && cancelUrl && (
              <>
                {' '}
                <Button style={secondaryButton} href={cancelUrl}>Cancel appointment</Button>
              </>
            )}
          </Section>

          {whatsappUrl && (
            <Section style={{ textAlign: 'center', margin: '4px 0 8px' }}>
              <Button style={whatsappButton} href={whatsappUrl}>Message us on WhatsApp</Button>
            </Section>
          )}

          <Hr style={hr} />
          <Text style={small}>
            If this cancellation was a mistake, just reply to this email and we'll
            help you get rebooked.
          </Text>
        </Section>
        <Text style={footer}>{SITE_NAME} • Premium skin & wellness</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: BookingCancelReschedule,
  subject: `Your ${SITE_NAME} appointment has been cancelled`,
  displayName: 'Cancel / reschedule link',
  previewData: {
    clientName: 'Aisha',
    treatment: 'Hydrafacial',
    date: 'Saturday, 3 May 2026',
    time: '11:00 AM',
    rebookUrl: 'https://tropics-medspa-pro.lovable.app/book',
    whatsappUrl: 'https://wa.me/?text=Hi%20Tropics%20MedSpa',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Poppins, Arial, sans-serif' }
const container = { maxWidth: '560px', margin: '0 auto', padding: '24px 16px' }
const header = { textAlign: 'center' as const, padding: '8px 0 20px' }
const brand = { color: '#2D1B47', fontSize: '22px', fontWeight: 'bold' as const, letterSpacing: '0.04em', margin: 0 }
const card = { backgroundColor: '#faf8ff', borderRadius: '14px', padding: '28px 26px', border: '1px solid #ece6f7' }
const h1 = { color: '#2D1B47', fontSize: '22px', fontWeight: 'bold' as const, margin: '0 0 14px' }
const text = { color: '#4a4458', fontSize: '15px', lineHeight: '1.6', margin: '0 0 18px' }
const detailBlock = { backgroundColor: '#ffffff', borderRadius: '10px', padding: '16px 18px', margin: '14px 0' }
const detail = { color: '#2D1B47', fontSize: '14px', margin: '4px 0' }
const primaryButton = {
  backgroundColor: '#C9A961', color: '#1a0f2e', borderRadius: '8px',
  padding: '12px 22px', fontWeight: 'bold' as const, fontSize: '14px',
  textDecoration: 'none', display: 'inline-block',
}
const secondaryButton = {
  backgroundColor: '#ffffff', color: '#2D1B47', borderRadius: '8px',
  padding: '12px 22px', fontWeight: 'bold' as const, fontSize: '14px',
  textDecoration: 'none', display: 'inline-block',
  border: '1px solid #2D1B47',
}
const whatsappButton = {
  backgroundColor: '#25D366', color: '#0b3d20', borderRadius: '8px',
  padding: '10px 20px', fontWeight: 'bold' as const, fontSize: '13px',
  textDecoration: 'none', display: 'inline-block',
}
const hr = { borderColor: '#ece6f7', margin: '22px 0 14px' }
const small = { color: '#7a7390', fontSize: '12px', lineHeight: '1.5', margin: 0 }
const footer = { color: '#9c95b3', fontSize: '11px', textAlign: 'center' as const, margin: '20px 0 0' }