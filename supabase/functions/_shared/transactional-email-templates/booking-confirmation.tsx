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
  practitionerName?: string
  manageUrl?: string
  location?: string
  whatsappUrl?: string
}

const BookingConfirmation = ({
  clientName,
  treatment,
  date,
  time,
  practitionerName,
  manageUrl,
  location,
  whatsappUrl,
}: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Your {SITE_NAME} appointment is confirmed</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={header}>
          <Heading style={brand}>{SITE_NAME}</Heading>
        </Section>
        <Section style={card}>
          <Heading style={h1}>
            {clientName ? `Hi ${clientName}, you're booked in ✨` : `You're booked in ✨`}
          </Heading>
          <Text style={text}>
            Thank you for choosing {SITE_NAME}. We're excited to see you. Here are
            the details of your appointment:
          </Text>

          <Section style={detailBlock}>
            {treatment && <Text style={detail}><strong>Treatment:</strong> {treatment}</Text>}
            {date && <Text style={detail}><strong>Date:</strong> {date}</Text>}
            {time && <Text style={detail}><strong>Time:</strong> {time}</Text>}
            {practitionerName && (
              <Text style={detail}><strong>With:</strong> {practitionerName}</Text>
            )}
            {location && <Text style={detail}><strong>Location:</strong> {location}</Text>}
          </Section>

          {manageUrl && (
            <Section style={{ textAlign: 'center', margin: '28px 0 8px' }}>
              <Button style={button} href={manageUrl}>Manage your booking</Button>
            </Section>
          )}

          {whatsappUrl && (
            <Section style={{ textAlign: 'center', margin: '8px 0 4px' }}>
              <Button style={whatsappButton} href={whatsappUrl}>Message us on WhatsApp</Button>
            </Section>
          )}

          <Hr style={hr} />
          <Text style={small}>
            Please arrive 5–10 minutes before your appointment. If you need to make
            changes, use the link above or reply to this email.
          </Text>
        </Section>
        <Text style={footer}>{SITE_NAME} • Premium skin & wellness</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: BookingConfirmation,
  subject: (data: Record<string, any>) =>
    data?.treatment
      ? `Confirmed: ${data.treatment} at ${SITE_NAME}`
      : `Your ${SITE_NAME} appointment is confirmed`,
  displayName: 'Booking confirmation',
  previewData: {
    clientName: 'Aisha',
    treatment: 'Hydrafacial',
    date: 'Saturday, 3 May 2026',
    time: '11:00 AM',
    practitionerName: 'Tola Adebayo',
    manageUrl: 'https://tropics-medspa-pro.lovable.app/book',
    location: 'Tropics MedSpa, Wonderland Estate, Kukwaba, Abuja',
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
const button = {
  backgroundColor: '#C9A961', color: '#1a0f2e', borderRadius: '8px',
  padding: '12px 24px', fontWeight: 'bold' as const, fontSize: '14px',
  textDecoration: 'none', display: 'inline-block',
}
const whatsappButton = {
  backgroundColor: '#25D366', color: '#0b3d20', borderRadius: '8px',
  padding: '10px 20px', fontWeight: 'bold' as const, fontSize: '13px',
  textDecoration: 'none', display: 'inline-block',
}
const hr = { borderColor: '#ece6f7', margin: '22px 0 14px' }
const small = { color: '#7a7390', fontSize: '12px', lineHeight: '1.5', margin: 0 }
const footer = { color: '#9c95b3', fontSize: '11px', textAlign: 'center' as const, margin: '20px 0 0' }